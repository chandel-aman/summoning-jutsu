const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const outputDir = path.join(process.cwd(), "otaku-archive");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const blogDir = "attack-on-blogs";
const blogs = [];

fs.readdirSync(blogDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .forEach((dir) => {
    const mdxPath = path.join(blogDir, dir.name, "index.mdx");
    if (fs.existsSync(mdxPath)) {
      const fileContent = fs.readFileSync(mdxPath, "utf-8");
      const { data } = matter(fileContent);
      blogs.push({
        slug: dir.name,
        path: `${dir.name}/index.mdx`,
        description: data.description || "",
      });
    }
  });

fs.writeFileSync(
  path.join(outputDir, "blogs.json"),
  JSON.stringify(blogs, null, 2)
);
console.log("blogs.json with descriptions generated!");

// ---- About JSON ----
const aboutPath = path.join("origin-arc", "index.mdx");
if (fs.existsSync(aboutPath)) {
  fs.writeFileSync(
    path.join(outputDir, "about.json"),
    JSON.stringify({ path: "origin-arc/index.mdx" }, null, 2)
  );
  console.log("about.json generated!");
} else {
  console.log("No about page found");
}
