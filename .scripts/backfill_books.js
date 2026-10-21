import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { Octokit } from "@octokit/rest";
import { searchBook } from "./open_library.js";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

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
  console.log(`Found ${books.length} existing books in books.json`);
}

// Get all issues from the repository
console.log("Fetching all issues...");
const { data: issues } = await octokit.issues.listForRepo({
  owner,
  repo,
  state: "all", // Get both open and closed issues
  per_page: 100, // Maximum per page
});

console.log(`Found ${issues.length} total issues`);

// Filter out pull requests (issues have pull_request field when they're PRs)
const actualIssues = issues.filter(issue => !issue.pull_request);
console.log(`Found ${actualIssues.length} actual issues (excluding PRs)`);

let addedCount = 0;
let skippedCount = 0;

for (const issue of actualIssues) {
  const issueNumber = issue.number;
  const bookTitle = issue.title;
  const isClosed = issue.state === "closed";
  
  // Check if this issue is already in our books.json
  const existingBook = books.find(book => book.issue_number === issueNumber);
  
  if (existingBook) {
    console.log(`Skipping issue #${issueNumber} - already exists in books.json`);
    skippedCount++;
    continue;
  }
  
  console.log(`Processing issue #${issueNumber}: ${bookTitle} (${issue.state})`);
  
  try {
    const found = await searchBook(bookTitle);

    if (!found) {
      console.log(`❌ Book not found for: ${bookTitle}`);
      // Still add it to the list but mark as not found
      const bookEntry = {
        title: bookTitle,
        author: "Unknown",
        image: "",
        status: isClosed ? "completed" : "reading",
        start_date: issue.created_at.split("T")[0],
        end_date: isClosed ? issue.closed_at?.split("T")[0] || new Date().toISOString().split("T")[0] : null,
        issue_number: issueNumber,
        not_found: true,
      };
      books.push(bookEntry);
      addedCount++;
      continue;
    }

    const bookEntry = {
      ...found,
      status: isClosed ? "completed" : "reading",
      start_date: issue.created_at.split("T")[0],
      end_date: isClosed ? issue.closed_at?.split("T")[0] || new Date().toISOString().split("T")[0] : null,
      issue_number: issueNumber,
    };

    books.push(bookEntry);
    addedCount++;
    console.log(`✅ Added: ${bookEntry.title} by ${bookEntry.author}`);

    // Open Library: 1 req/s anonymous
    await new Promise(resolve => setTimeout(resolve, 1100));
    
  } catch (error) {
    console.error(`Error processing issue #${issueNumber}:`, error.message);
  }
}

// Sort books by issue number for consistency
books.sort((a, b) => a.issue_number - b.issue_number);

// Write the updated books.json
writeFileSync(booksFile, JSON.stringify(books, null, 2));
console.log(`\n📚 Backfill complete!`);
console.log(`- Added ${addedCount} new books`);
console.log(`- Skipped ${skippedCount} existing books`);
console.log(`- Total books in books.json: ${books.length}`);
