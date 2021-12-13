import dotenv from "dotenv";
dotenv.config();

import fs from "fs-extra";
// import _ from "lodash";
import { globby } from "globby";
import fetch from "node-fetch";
import pLimit from "p-limit";

const CONCURRENCY = process.env.BUNNY_CONCURRENT_UPLOADS || 50;
const limit = pLimit(CONCURRENCY);

const ACCESSKEY = process.env.BUNNY_STORAGE_EPJ_JS_PASSWORD;
const endpoint = `https://${process.env.BUNNY_STORAGE_EPJ_JS_HOSTNAME}`;
const storageZoneName = `/${process.env.BUNNY_STORAGE_EPJ_JS_USERNAME}/`;

const filesDir = "dist";

const options = {
  headers: {
    "Content-Type": "application/octet-stream",
    AccessKey: ACCESSKEY,
  },
};

async function put(s, d) {
  try {
    const response = await fetch(`${endpoint}${storageZoneName}${d}`, {
      ...options,
      method: "PUT",
      body: fs.createReadStream(`${filesDir}/${s}`),
    });
    const data = await response.json();

    return data;
  } catch (error) {
    console.log(error);
  }
}

async function start() {
  console.time("Upload Files to Edge Storage");

  // const files = await globby(["**/*.*"], { cwd: filesDir });
  const files = [
    ["epj_prebid.min.js", "epj_prebid.min.js"],
    ["opj_prebid.min.js", "opj_prebid.min.js"],
  ];

  console.log("Total number of files:", files.length);

  const promises = files.map((i) => limit(() => put(...i)));

  await Promise.all(promises);

  console.timeEnd("Upload Files to Edge Storage");

  fetch(
    `https://api.bunny.net/pullzone/${process.env.BUNNY_STORAGE_EPJ_JS_PULL_ZONE_ID}/purgeCache`,
    { method: "POST", headers: { AccessKey: process.env.BUNNY_ACCESSKEY } }
  )
    .then(() => console.log("The cache was successfuly purged"))
    .catch((err) => console.error(err));
}

start();
