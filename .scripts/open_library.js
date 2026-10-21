import fetch from "node-fetch";

const HEADERS = { "User-Agent": "blogs-book-tracker (https://github.com/chandel-aman/blogs)" };
const FIELDS = "key,title,author_name,cover_i,isbn,first_publish_year,publish_date,number_of_pages_median";

export async function searchBook(title, { fetchDescription = false } = {}) {
  const params = new URLSearchParams({ title, limit: "10", fields: FIELDS });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Open Library search failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.docs?.length) return null;

  const doc = data.docs.find((d) => d.cover_i) || data.docs[0];
  const isbn = doc.isbn?.find((i) => i.length === 13) || doc.isbn?.[0] || "";

  let description = "";
  if (fetchDescription && doc.key) {
    try {
      const workRes = await fetch(`https://openlibrary.org${doc.key}.json`, { headers: HEADERS });
      if (workRes.ok) {
        const work = await workRes.json();
        description = typeof work.description === "string" ? work.description : work.description?.value || "";
      }
    } catch {}
  }

  return {
    title: doc.title || title,
    author: doc.author_name?.join(", ") || "Unknown",
    image: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : isbn
        ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
        : "",
    open_library_id: doc.key || "",
    isbn,
    published_date: doc.first_publish_year ? String(doc.first_publish_year) : doc.publish_date?.[0] || "",
    description,
    page_count: doc.number_of_pages_median || null,
  };
}
