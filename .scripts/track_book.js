import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const issueNumber = process.env.GITHUB_EVENT_ISSUE_NUMBER;
const eventAction = process.env.GITHUB_EVENT_ACTION;

if (!issueNumber) {
  console.log("No issue number found, exiting...");
  process.exit(0);
}

const { data: issue } = await octokit.issues.get({
  owner,
  repo,
  issue_number: issueNumber,
});

const bookTitle = issue.title;
console.log(`Processing book: ${bookTitle} (Action: ${eventAction})`);

// Update books.json in the same directory
const booksDir = join(process.cwd(), "otaku-archive");
const booksFile = join(booksDir, "books.json");

// Ensure the directory exists
if (!existsSync(booksDir)) {
  mkdirSync(booksDir, { recursive: true });
}

let books = [];
if (existsSync(booksFile)) {
  books = JSON.parse(readFileSync(booksFile, "utf-8"));
}

if (eventAction === "opened") {
  // Search Open Library
  const query = encodeURIComponent(bookTitle);
  const res = await fetch(
    `https://openlibrary.org/search.json?title=${query}&limit=1`
  );
  const data = await res.json();

  if (data.numFound === 0) {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `❌ Book not found: ${bookTitle}`,
    });
    process.exit(0);
  }

  // Get book details
  const book = data.docs[0];
  const bookEntry = {
    title: book.title,
    author: book.author_name || "Unknown",
    image: book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
      : "",
    status: "reading",
    start_date: new Date().toISOString().split("T")[0],
    end_date: null,
    issue_number: parseInt(issueNumber),
  };

  books.push(bookEntry);
  writeFileSync(booksFile, JSON.stringify(books, null, 2));
  console.log("books.json updated!");

  // Comment on the issue
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: `✅ Book added: **${bookEntry.title}** by ${bookEntry.author}`,
  });

} else if (eventAction === "closed") {
  // Find and update the book to completed using issue number
  const bookIndex = books.findIndex(book => 
    book.issue_number === parseInt(issueNumber)
  );

  if (bookIndex !== -1) {
    books[bookIndex].status = "completed";
    books[bookIndex].end_date = new Date().toISOString().split("T")[0];
    
    writeFileSync(booksFile, JSON.stringify(books, null, 2));
    console.log("books.json updated - book marked as completed!");

    // Comment on the issue
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `🎉 Book completed: **${books[bookIndex].title}** by ${books[bookIndex].author}`,
    });
  } else {
    console.log(`Book not found in books.json for issue #${issueNumber}`);
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `⚠️ Book not found in tracking list for issue #${issueNumber}`,
    });
  }
}
