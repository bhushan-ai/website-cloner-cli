#!/usr/bin/env node
import "dotenv/config";
import puppeteer from "puppeteer";
import fs from "fs";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import { OpenAI } from "openai";
import { exec } from "child_process";
import readline from "readline";
import gradient, { cristal, fruit, teen, vice } from "gradient-string";
import figlet from "figlet";

const args = process.argv.slice(2);

let folderName;
let siteUrl;

if (args[0] === "clone") {
  siteUrl = args[1];
  folderName = args[2];

  if (!siteUrl || !folderName) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    figlet.text(
      "WELCOME TO CHAICODE CLI",
      {
        font: "ANSI Shadow",
        horizontalLayout: "default",
        verticalLayout: "default",
        width: 96,
      },
      (err, data) => {
        console.log(gradient.pastel.multiline(data));

        rl.question(teen("🧠 Give the URL of the website: "), (url) => {
          siteUrl = url;

          rl.question(vice("🧠 Give the folder name: "), (folder) => {
            folderName = folder;

            console.log(
              fruit(`Cloning ${siteUrl} into folder ${folderName}...`)
            );

            rl.close();
            main();
          });
        });
      }
    );
  } else {
    console.log("🚀 Bhushan AI CLI working!");
    console.log(`✅ Cloning ${siteUrl} into folder ${folderName}...`);
  }
}

async function createWebsite(url, outputDir) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  //get page content
  const html = await page.content();

  const $ = cheerio.load(html);

  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }
  //save html
  fs.writeFileSync(path.join(outputDir, "index.html"), $.html());

  //download
  async function downloadFile(fileUrl, folder, filename) {
    try {
      const response = await axios.get(fileUrl, {
        responseType: "arraybuffer",
      });
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, filename), response.data);
      //  console.log(`✅ Saved: ${filename}`);
      return path.join(folder, filename);
    } catch (err) {
      console.error(`❌ Failed to download ${fileUrl}`);
      return null;
    }
  }

  const cssLinks = $("link[rel='stylesheet']");
  for (let i = 0; i < cssLinks.length; i++) {
    let cssUrl = $(cssLinks[i]).attr("href");
    if (cssUrl) {
      cssUrl = new URL(cssUrl, url).href;
      const filename = path.basename(cssUrl.split("?")[0]);
      await downloadFile(cssUrl, outputDir, filename);
      $(cssLinks[i]).attr("href", filename);
    }
  }

  const jsLinks = $("script[src]");
  for (let i = 0; i < jsLinks.length; i++) {
    let jsUrl = $(jsLinks[i]).attr("src");
    if (jsUrl) {
      jsUrl = new URL(jsUrl, url).href;
      const filename = path.basename(jsUrl.split("?")[0]);
      await downloadFile(jsUrl, outputDir, filename);
      $(jsLinks[i]).attr("src", filename);
    }
  }


  //down img
  const imgTags = $("img");
  //console.log("images", imgTags);
  for (let i = 0; i < imgTags.length; i++) {
    let rawSrcSet = $(imgTags[i]).attr("srcset");
    let imgUrl = $(imgTags[i]).attr("src");
    if (rawSrcSet) {
      let parts = rawSrcSet.split(",").map((p) => p.trim());
      let lastPart = parts[parts.length - 1];
      imgUrl = lastPart.split(" ")[0];
    }

    let finalUrl = imgUrl;
    if (imgUrl.includes("/_next/image?")) {
      const parsed = new URL(imgUrl, url);
      const realPath = parsed.searchParams.get("url");
      if (realPath) {
        finalUrl = new URL(realPath, url).href;
      } else {
        finalUrl = new URL(imgUrl, url).href;
      }
    } else if (imgUrl.startsWith("/")) {
      finalUrl = new URL(imgUrl, url).href;
    }

    try {
      const filename = path.basename(finalUrl.split("?")[0]);

      await downloadFile(finalUrl, outputDir, filename);
      $(imgTags[i]).attr("src", filename);
      $(imgTags[i]).removeAttr("srcset");
    } catch (error) {
      console.error("❌ Failed to download:", finalUrl, error.message);
    }
  }

  const faviconLinks = $("link[rel='icon'], link[rel='shortcut icon']");
  for (let i = 0; i < faviconLinks.length; i++) {
    let favUrl = $(faviconLinks[i]).attr("href");
    if (favUrl) {
      favUrl = new URL(favUrl, url).href;
      const filename = path.basename(favUrl.split("?")[0]);
      await downloadFile(favUrl, outputDir, filename);
      $(faviconLinks[i]).attr("href", filename);
    }
  }

  const fontsLinks = $("link[rel='stylesheet'][href*='fonts.googleapis']");
  for (let i = 0; i < fontsLinks.length; i++) {
    let fontUrl = $(fontsLinks[i]).attr("href");
    if (fontUrl) {
      fontUrl = new URL(fontUrl, url).href;
      const filename = "fonts.css";
      await downloadFile(fontUrl, outputDir, filename);
      $(fontsLinks[i]).attr("href", filename);
    }
  }


  const iframes = $("iframe");
  for (let i = 0; i < iframes.length; i++) {
    let iframeSrc = $(iframes[i]).attr("src");
    if (iframeSrc) {
      try {
        const absoluteIframeUrl = new URL(iframeSrc, url).href;

        const iframeDir = path.join(outputDir, `iframe_${i}`);
        const iframeIndex = path.join(iframeDir, "index.html");

        // recursively clone the iframe site with assets
        await createWebsite(absoluteIframeUrl, iframeDir, browser);

        $(iframes[i]).attr("src", path.relative(outputDir, iframeIndex));
        //console.log(`✅ Cloned iframe ${iframeSrc}`);
      } catch (err) {
        console.error(`❌ Failed to clone iframe: ${iframeSrc}, err.message`);
      }
    }
  }




  fs.writeFileSync(path.join(outputDir, "index.html"), $.html());
  await browser.close();
  //console.log("🎉 Website fully cloned (HTML + CSS + JS + Images + Fonts)!");

  return `Website cloned successfully into folder: ${outputDir}`;
}

async function getCommandAndExecute(cmd = "") {
  return new Promise((res, rej) => {
    exec(cmd, (err, data) => {
      if (err) {
        return rej(`error is comming ${err}`);
      } else {
        return res(data);
      }
    });
  });
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const TOOL_MAP = {
  createWebsite: createWebsite,
  getCommandAndExecute: getCommandAndExecute,
};

async function main() {
  let SYSTEM_PROMPT;
  if (siteUrl && folderName) {
    SYSTEM_PROMPT = `
You are a Website Cloner Agent 🕸️ whose only job is to clone websites exactly as they appear using HTML, CSS, and JavaScript.

Your workflow always follows these steps in order:
1. START → Understand the user’s intent (what website, what folder).
2. THINK → Plan the step-by-step actions needed (create folder, run commands, call tools).
3. TOOL → Call the correct tool with exact inputs.
4. OBSERVE → Wait for and read the tool's response.
5. THINK → Interpret what the tool returned.
6. OUTPUT → Report progress or completion to the user.

⚡ Rules:
- Always follow the JSON format for every message.
- Perform only **one step at a time**. Do not skip ahead.
- Never stringify the tool input. Always pass it as a JSON object.
- Always wait for OBSERVE (tool result) before continuing.
- Always think in multiple THINK steps before making a TOOL call.
- Always sound like a real web cloning agent, describing progress clearly.

📦 Available Tools:
- createWebsite(url: string, outputDir: string) → Clones the website from the given URL into the given folder.
   ✅ Example:
   {
     "step": "TOOL",
     "tool_name": "createWebsite",
     "input": { "url": "https://example.com", "outputDir": "my-clone-folder" }
   }

- getCommandAndExecute(command: string) → Executes system commands like creating folders or files.
   ✅ Example:
   {
     "step": "TOOL",
     "tool_name": "getCommandAndExecute",
     "input": "mkdir my-clone-folder"
   }

📋 Output JSON Format:
{ "step": "START | THINK | TOOL | OBSERVE | OUTPUT", "content": "string", "tool_name": "string (only for TOOL)", "input": "JSON or string (depending on tool)" }

---

### Example Interaction:
User: Clone https://bhushan-ai.netlify.app/ into a folder bhushan-portfolio-clone

ASSISTANT:
{ 
"step": "START", 
"content": "The user wants me to clone the website https://bhushan-ai.netlify.app/ into a folder named bhushan-portfolio-clone.
" }
ASSISTANT:
 { "step": "THINK",
  "content": "First, I need to ensure the folder exists to store the cloned website."
   }
ASSISTANT:
 { "step": "TOOL", 
  "tool_name": "getCommandAndExecute", "input": "mkdir bhushan-portfolio-clone" 
  }
DEVELOPER:
 { "step": "OBSERVE",
   "content": "✅ Folder created successfully"
    }
ASSISTANT: 
{ "step": "THINK", 
 "content": "Now that the folder exists, I can use the createWebsite tool to clone the site into it." 
 }
ASSISTANT: 
{ "step": "TOOL",
  "tool_name": "createWebsite",
   "input": { "url": "https://bhushan-ai.netlify.app/",
    "outputDir": "bhushan-portfolio-clone" } 
    }
DEVELOPER:
 { "step": "OBSERVE",
   "content": "🎉 Website successfully cloned into bhushan-portfolio-clone"
    }
ASSISTANT: { "step": "OUTPUT",
 "content": "The website https://bhushan-ai.netlify.app/ has been cloned successfully into the folder bhushan-portfolio-clone 🚀" 
 }
`;
  }
  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `can u clone this site ${siteUrl} in ${folderName} folder `,
    },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messages,
      max_tokens: 500,
    });

    const rawContent = response.choices[0].message.content;
    const parsedContent = JSON.parse(rawContent);

    messages.push({
      role: "assistant",
      content: JSON.stringify(parsedContent),
    });

    if (parsedContent.step === "START") {
      // console.log(`🔥`, parsedContent.content);
      continue;
    }

    if (parsedContent.step === "THINK") {
      //console.log(`\t🧠`, parsedContent.content);

      continue;
    }

    if (parsedContent.step === "TOOL") {
      const toolToCall = parsedContent.tool_name;
      if (!TOOL_MAP[toolToCall]) {
        messages.push({
          role: "developer",
          content: "there is no such tool",
        });
        continue;
      }

      let res;
      if (toolToCall === "createWebsite") {
        let toolInput = parsedContent.input;

        if (typeof toolInput === "string") {
          try {
            toolInput = JSON.parse(toolInput);
          } catch (e) {
            throw new Error(`❌ Failed to parse tool input: ${toolInput}`);
          }
        }

        const { url, outputDir } = toolInput || {};
        if (!url || !outputDir) {
          throw new Error(
            `❌ Invalid tool input for createWebsite: ${JSON.stringify(
              parsedContent
            )}`
          );
        }

        res = await TOOL_MAP[toolToCall](url, outputDir);
      }
      //  console.log(`🛠️: ${toolToCall}(${parsedContent.input}) = `, res);

      messages.push({
        role: "developer",
        content: JSON.stringify({ step: "OBSERVE", content: res }),
      });
    }

    if (parsedContent.step === "OUTPUT") {
      console.log(`🤖`, cristal(`${parsedContent.content}`));
      break;
    }
  }

  console.log("Done...");
}
