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
if (!existsSync(outputDir)) mkdirSync(outputDir);

const blogDir = "attack-on-blogs";
const blogs = [];

readdirSync(blogDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .forEach((dir) => {
    const mdxPath = join(blogDir, dir.name, "index.mdx");
    if (existsSync(mdxPath)) {
      const fileContent = readFileSync(mdxPath, "utf-8");
      const { data } = matter(fileContent);
      blogs.push({
        slug: dir.name,
        path: `${dir.name}/index.mdx`,
        description: data.description || "",
      });
    }
  });

writeFileSync(join(outputDir, "blogs.json"), JSON.stringify(blogs, null, 2));
console.log("blogs.json with descriptions generated!");

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
