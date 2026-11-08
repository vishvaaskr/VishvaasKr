
const fs = require("node:fs");

const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;

const README_PATH = "README.md";

if (!USERNAME || !TOKEN) {
  throw new Error("Missing GITHUB_USERNAME or GITHUB_TOKEN");
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const languages = new Set();
const technologies = new Set();

// npm package -> technology
const PACKAGE_MAP = {
  "discord.js": "Discord.js",
  mongoose: "Mongoose",
  mongodb: "MongoDB",
  express: "Express",
  fastify: "Fastify",
  "@nestjs/core": "NestJS",
  react: "React",
  next: "Next.js",
  vue: "Vue.js",
  svelte: "Svelte",
  typescript: "TypeScript",
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  redis: "Redis",
  ioredis: "Redis",
  pg: "PostgreSQL",
  mysql2: "MySQL",
  sequelize: "Sequelize",
  drizzle: "Drizzle ORM",
  sharp: "Sharp",
  "@napi-rs/canvas": "Canvas",
  canvas: "Canvas",
  "node-fetch": "Node.js",
  axios: "Axios",
  graphql: "GraphQL",
  "socket.io": "Socket.IO",
  bullmq: "BullMQ",
  zod: "Zod",
  dotenv: "Node.js",
  "discord-api-types": "Discord.js",
};

const BADGES = {
  TypeScript: ["typescript", "3178C6", "white"],
  JavaScript: ["javascript", "F7DF1E", "black"],
  Python: ["python", "3776AB", "white"],
  Java: ["openjdk", "437291", "white"],
  "C++": ["cplusplus", "00599C", "white"],
  "C#": ["csharp", "239120", "white"],
  Go: ["go", "00ADD8", "white"],
  Rust: ["rust", "000000", "white"],
  HTML: ["html5", "E34F26", "white"],
  CSS: ["css3", "1572B6", "white"],
  Shell: ["gnubash", "4EAA25", "white"],

  "Node.js": ["nodedotjs", "339933", "white"],
  "Discord.js": ["discord", "5865F2", "white"],
  MongoDB: ["mongodb", "47A248", "white"],
  Mongoose: ["mongoose", "880000", "white"],
  Express: ["express", "000000", "white"],
  Fastify: ["fastify", "000000", "white"],
  NestJS: ["nestjs", "E0234E", "white"],
  React: ["react", "61DAFB", "black"],
  "Next.js": ["nextdotjs", "000000", "white"],
  "Vue.js": ["vuedotjs", "4FC08D", "white"],
  Svelte: ["svelte", "FF3E00", "white"],
  Prisma: ["prisma", "2D3748", "white"],
  Redis: ["redis", "DC382D", "white"],
  PostgreSQL: ["postgresql", "4169E1", "white"],
  MySQL: ["mysql", "4479A1", "white"],
  Sequelize: ["sequelize", "52B0E7", "white"],
  "Drizzle ORM": ["drizzle", "C5F74F", "black"],
  Sharp: ["sharp", "99CC00", "black"],
  Canvas: ["html5", "E34F26", "white"],
  Axios: ["axios", "5A29E4", "white"],
  GraphQL: ["graphql", "E10098", "white"],
  "Socket.IO": ["socketdotio", "010101", "white"],
  BullMQ: ["redis", "DC382D", "white"],
  Zod: ["zod", "3E67B1", "white"],
};

async function api(url) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `GitHub API error ${response.status}: ${url}`
    );
  }

  return response.json();
}

async function getRepositories() {
  const repositories = [];

  for (let page = 1; ; page++) {
    const data = await api(
      `https://api.github.com/users/${USERNAME}/repos?type=owner&per_page=100&page=${page}`
    );

    repositories.push(...data);

    if (data.length < 100) break;
  }

  return repositories.filter(
    repo => !repo.fork && !repo.archived
  );
}

async function inspectRepository(repo) {
  const base = `https://api.github.com/repos/${USERNAME}/${repo.name}`;

  // Detect programming languages
  const languageData = await api(`${base}/languages`);

  Object.keys(languageData).forEach(language => {
    languages.add(language);
  });

  // Inspect package.json
  try {
    const response = await fetch(
      `${base}/contents/package.json`,
      { headers }
    );

    if (!response.ok) return;

    const file = await response.json();
    const content = Buffer.from(
      file.content,
      "base64"
    ).toString("utf8");

    const packageJson = JSON.parse(content);

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    if (Object.keys(dependencies).length > 0) {
      technologies.add("Node.js");
    }

    for (const dependency of Object.keys(dependencies)) {
      const technology = PACKAGE_MAP[dependency];

      if (technology) {
        technologies.add(technology);
      }
    }
  } catch (error) {
    console.log(
      `Skipping package.json in ${repo.name}`
    );
  }
}

async function runWithConcurrency(items, limit, callback) {
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      await callback(current);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => worker()
    )
  );
}

function createBadges(items) {
  return [...items]
    .filter(name => BADGES[name])
    .sort()
    .map(name => {
      const [logo, color, logoColor] = BADGES[name];

      return `![${name}](https://img.shields.io/badge/${encodeURIComponent(name)}-${color}?style=for-the-badge&logo=${logo}&logoColor=${logoColor})`;
    })
    .join("\n");
}

async function main() {
  console.log("Fetching repositories...");

  const repositories = await getRepositories();

  console.log(`Found ${repositories.length} repositories.`);

  await runWithConcurrency(
    repositories,
    5,
    async repo => {
      try {
        console.log(`Scanning ${repo.name}...`);
        await inspectRepository(repo);
      } catch (error) {
        console.error(
          `Failed to scan ${repo.name}: ${error.message}`
        );
      }
    }
  );

  const detectedLanguages = new Set(
    [...languages].filter(name => BADGES[name])
  );

  const sections = [];

  if (detectedLanguages.size) {
    sections.push(
      "**Languages**\n\n" +
      createBadges(detectedLanguages)
    );
  }

  if (technologies.size) {
    sections.push(
      "**Frameworks, Libraries & Tools**\n\n" +
      createBadges(technologies)
    );
  }

  const generated = sections.length
    ? sections.join("\n\n")
    : "No technologies detected yet.";

  let readme = fs.readFileSync(README_PATH, "utf8");

  const start = "<!-- TECH-STACK:START -->";
  const end = "<!-- TECH-STACK:END -->";

  if (!readme.includes(start) || !readme.includes(end)) {
    throw new Error("Tech stack markers not found in README.");
  }

  const replacement = `${start}\n${generated}\n${end}`;

  readme = readme.replace(
    /<!-- TECH-STACK:START -->[\s\S]*?<!-- TECH-STACK:END -->/,
    replacement
  );

  fs.writeFileSync(README_PATH, readme);

  console.log("Tech stack updated successfully!");
  console.log("Languages:", [...detectedLanguages]);
  console.log("Technologies:", [...technologies]);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
