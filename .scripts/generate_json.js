import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import matter from "gray-matter";

const outputDir = join(process.cwd(), "otaku-archive");
const blogsDir = join(outputDir, "blogs");

// Create output directories
if (!existsSync(outputDir)) mkdirSync(outputDir);
if (!existsSync(blogsDir)) mkdirSync(blogsDir);

const blogDir = "attack-on-blogs";
const blogs = [];

// Helper function to calculate read time (rough estimate: 200 words per minute)
function calculateReadTime(content) {
  const wordCount = content.split(/\s+/).length;
  const readTime = Math.ceil(wordCount / 200);
  return `${readTime} min read`;
}

readdirSync(blogDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .forEach((dir) => {
    const mdxPath = join(blogDir, dir.name, "index.mdx");
    if (existsSync(mdxPath)) {
      const fileContent = readFileSync(mdxPath, "utf-8");
      const { data: frontmatter, content } = matter(fileContent);

      // Calculate word count and read time
      const wordCount = content.split(/\s+/).length;
      const readTime = calculateReadTime(content);

      // Create blog post object with all BlogPost interface fields except content
      const blogPost = {
        slug: dir.name,
        title:
          frontmatter.title ||
          dir.name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        description: frontmatter.description || "",
        date: frontmatter.date || new Date().toISOString().split("T")[0],
        readTime: readTime,
        path: `${dir.name}/index.mdx`,
        image: frontmatter.image || null,
        wordCount: wordCount,
      };

      blogs.push(blogPost);

      // Create individual <slug>.mdx file in blogs directory
      const individualMdxPath = join(blogsDir, `${dir.name}.mdx`);
      writeFileSync(individualMdxPath, fileContent);
    }
  });

// Sort blogs by date (newest first)
blogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

writeFileSync(join(outputDir, "blogs.json"), JSON.stringify(blogs, null, 2));
console.log("blogs.json with all BlogPost fields generated!");
console.log(`Individual MDX files created in ${blogsDir}`);

// ---- About JSON ----
const aboutPath = join("origin-arc", "index.mdx");
if (existsSync(aboutPath)) {
  writeFileSync(
    join(outputDir, "about.json"),
    JSON.stringify(
      {
        path: "origin-arc/index.mdx",
        content: readFileSync(aboutPath, "utf-8"),
      },
      null,
      2
    )
  );
  console.log("about.json generated!");
} else {
  console.log("No about page found");
}
