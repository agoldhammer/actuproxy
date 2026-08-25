import { subHours, format } from "date-fns";
import { MongoClient } from "mongodb";

interface Timespan {
  start: string;
  end: string;
}

interface ActuData {
  ndocs: number;
  articles: any[];
  count: number;
  timespan: Timespan;
}

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

// Request bounds. The UI offers windows of 3/6/12/24 hours and clamps
// timeframe at 0, so these caps sit well clear of anything the app sends.
// MAX_ARTICLES is the one that matters: the busiest real 24-hour window
// carries ~1200 articles, so 5000 never truncates a legitimate request while
// keeping a crafted timewindow from pulling all 1.3M documents into memory.
const MAX_WINDOW_HOURS = 168;
const MAX_TIMEFRAME = 10000;
const MAX_ARTICLES = 5000;
const MAX_QUERY_LEN = 200;

const timestamp = () => `[${new Date().toUTCString()}]`;
const tsLog = (...args: any[]) => console.log(timestamp(), ...args);

// Parse a search param as an integer in [min, max]. Anything non-numeric or
// out of range comes back null so the caller can answer 400, instead of
// letting NaN reach subHours() and build an Invalid Date that only blows up
// later inside format().
function intParam(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number | null {
  if (raw === null || raw.length === 0) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) return null;
  return n;
}

async function getData(
  start: Date,
  end: Date,
  txtquery: string | null
): Promise<ActuData> {
  const client = new MongoClient(uri);
  try {
    const db = client.db("actur");
    const articles = db.collection("articles");
    const ndocs = await articles.estimatedDocumentCount();
    let query = {};
    if (txtquery === null || txtquery === undefined || txtquery.length === 0) {
      query = { pubdate: { $gte: start, $lt: end } };
    } else {
      tsLog("txtquery", txtquery);

      query = {
        pubdate: { $gte: start, $lt: end },
        $text: {
          $search: txtquery,
          $caseSensitive: false,
          $diacriticSensitive: false,
        },
      };
    }

    // A Mongo failure here propagates to the caller, which turns it into a
    // bare 500. The old code caught it, left data undefined, and then threw a
    // confusing TypeError on data.length.
    const data = await articles
      .find(query, {
        projection: {
          _id: 0,
          title: 1,
          summary: 1,
          pubdate: 1,
          pubname: 1,
          link: 1,
          hash: 1,
          cat: 1,
        },
      })
      .sort({ pubdate: -1 })
      .limit(MAX_ARTICLES)
      .toArray();

    return {
      ndocs: ndocs,
      articles: data,
      count: data.length,
      timespan: {
        start: format(start, "EEE HH:mm O"),
        end: format(end, "EEE HH:mm O"),
      },
    };
  } finally {
    await client.close();
  }
}

const server = Bun.serve({
  port: 33433, // defaults to $BUN_PORT, $PORT, $NODE_PORT otherwise 3000
  hostname: "localhost",

  async fetch(req) {
    const url = new URL(req.url);
    const sparams = url.searchParams;

    const tf = intParam(sparams.get("timeframe"), 0, 0, MAX_TIMEFRAME);
    const tw = intParam(sparams.get("timewindow"), 2, 1, MAX_WINDOW_HOURS);
    if (tf === null || tw === null) {
      return Response.json(
        { error: "timeframe and timewindow must be integers within range" },
        { status: 400 }
      );
    }

    const txtquery = sparams.get("txtquery");
    if (txtquery !== null && txtquery.length > MAX_QUERY_LEN) {
      return Response.json(
        { error: `txtquery must be at most ${MAX_QUERY_LEN} characters` },
        { status: 400 }
      );
    }

    tsLog("params", tf, tw, "tq", txtquery);

    const now = new Date();
    const end: Date = subHours(now, tf * tw);
    const start: Date = subHours(end, tw);

    try {
      return Response.json(await getData(start, end, txtquery));
    } catch (error) {
      // Detail stays in the log; the client gets a status and nothing else.
      tsLog("request failed:", error);
      return Response.json({ error: "internal server error" }, { status: 500 });
    }
  },

  // Last-resort handler for anything fetch() did not catch. It must never echo
  // the error or its stack -- this response goes straight to the public
  // internet through nginx.
  error(error) {
    tsLog("unhandled error:", error);
    return Response.json({ error: "internal server error" }, { status: 500 });
  },
});

tsLog(`ActuProxy serving on ${server.hostname}:${server.port}`);
