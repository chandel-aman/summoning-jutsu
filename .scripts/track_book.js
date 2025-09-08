import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const issueNumber = process.env.GITHUB_EVENT_ISSUE_NUMBER;

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
console.log(`Processing book: ${bookTitle}`);

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
  author: book.author_name?.[0] || "Unknown",
  image: book.cover_i
    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
    : "",
  status: "reading",
  start_date: new Date().toISOString().split("T")[0],
  end_date: null,
};

// Update books.json in the same directory
const booksFile = path.join(process.cwd(), "otaku-archive", "books.json");
let books = [];
if (fs.existsSync(booksFile)) {
  books = JSON.parse(fs.readFileSync(booksFile, "utf-8"));
}

books.push(bookEntry);
fs.writeFileSync(booksFile, JSON.stringify(books, null, 2));
console.log("books.json updated!");

// Comment on the issue
await octokit.issues.createComment({
  owner,
  repo,
  issue_number: issueNumber,
  body: `✅ Book added: **${bookEntry.title}** by ${bookEntry.author}`,
});
