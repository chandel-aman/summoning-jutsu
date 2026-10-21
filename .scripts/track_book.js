import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Octokit } from "@octokit/rest";
import { searchBook } from "./open_library.js";

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
  const found = await searchBook(bookTitle, { fetchDescription: true });

  if (!found) {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `❌ Book not found: ${bookTitle}`,
    });
    process.exit(0);
  }

  const bookEntry = {
    ...found,
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
  const targetIssueNumber = parseInt(issueNumber);
  console.log(`Looking for book with issue number: ${targetIssueNumber} (type: ${typeof targetIssueNumber})`);
  console.log(`Available books:`, books.map(book => ({ title: book.title, issue_number: book.issue_number, type: typeof book.issue_number })));
  
  const bookIndex = books.findIndex(book => 
    parseInt(book.issue_number) === targetIssueNumber
  );

  if (bookIndex !== -1) {
    books[bookIndex].status = "completed";
    books[bookIndex].end_date = new Date().toISOString().split("T")[0];
    
    writeFileSync(booksFile, JSON.stringify(books, null, 2));
    console.log("books.json updated - book marked as completed!");

    // Handle author field - it might be an array or string
    const author = Array.isArray(books[bookIndex].author) 
      ? books[bookIndex].author.join(", ") 
      : books[bookIndex].author;

    // Comment on the issue
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `🎉 Book completed: **${books[bookIndex].title}** by ${author}`,
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

} else if (eventAction === "deleted") {
  // Find and remove the book using issue number
  const targetIssueNumber = parseInt(issueNumber);
  console.log(`Looking for book to delete with issue number: ${targetIssueNumber}`);
  console.log(`Available books:`, books.map(book => ({ title: book.title, issue_number: book.issue_number })));
  
  const bookIndex = books.findIndex(book => 
    parseInt(book.issue_number) === targetIssueNumber
  );

  if (bookIndex !== -1) {
    const deletedBook = books[bookIndex];
    books.splice(bookIndex, 1); // Remove the book from the array
    
    writeFileSync(booksFile, JSON.stringify(books, null, 2));
    console.log(`Book removed from books.json: ${deletedBook.title}`);

    // Handle author field - it might be an array or string
    const author = Array.isArray(deletedBook.author) 
      ? deletedBook.author.join(", ") 
      : deletedBook.author;

    console.log(`🗑️ Book deleted: **${deletedBook.title}** by ${author}`);
  } else {
    console.log(`Book not found in books.json for issue #${issueNumber} - nothing to delete`);
  }
}
