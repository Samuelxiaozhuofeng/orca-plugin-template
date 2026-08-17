import {
  MIN_CARD_HEIGHT,
  MIN_CARD_WIDTH,
} from "./layout.ts";
import {
  MEDIA_CARD_HEIGHT_AUDIO,
  MEDIA_CARD_HEIGHT_EPUB,
  MEDIA_CARD_HEIGHT_IMAGE,
  MEDIA_CARD_HEIGHT_PDF,
  MEDIA_CARD_HEIGHT_VIDEO,
  MEDIA_CARD_KINDS,
  MEDIA_CARD_WIDTH,
  mediaCardSize,
  mediaKindOfBlock,
  type MediaCardKind,
} from "./mediaCard.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

function propsBlock(type: unknown): unknown {
  return { properties: [{ name: "_repr", value: { type } }] };
}

function directBlock(type: unknown): unknown {
  return { _repr: { type } };
}

for (const kind of MEDIA_CARD_KINDS) {
  check(
    mediaKindOfBlock(propsBlock(kind)) === kind,
    `${kind} via properties _repr`,
  );
  check(
    mediaKindOfBlock(directBlock(kind)) === kind,
    `${kind} via object _repr`,
  );
}

check(mediaKindOfBlock(propsBlock("text")) === null, "text is not media");
check(
  mediaKindOfBlock(directBlock("text")) === null,
  "direct text _repr is not media",
);
check(
  mediaKindOfBlock(propsBlock("whiteboard.canvas")) === null,
  "whiteboard.canvas is not media",
);
check(
  mediaKindOfBlock(directBlock("whiteboard.canvas")) === null,
  "direct whiteboard.canvas is not media",
);
check(mediaKindOfBlock(propsBlock("quote2")) === null, "quote2 is not media");
check(
  mediaKindOfBlock(directBlock("quote2")) === null,
  "direct quote2 is not media",
);

const malformed: unknown[] = [
  null,
  undefined,
  {},
  { properties: "x" },
  { _repr: [{ type: "image" }] },
  { properties: [{ name: "_repr", value: [{ type: "image" }] }] },
];

for (const input of malformed) {
  let kind: MediaCardKind | null = null;
  let threw = false;
  try {
    kind = mediaKindOfBlock(input);
  } catch {
    threw = true;
  }
  check(!threw, `malformed ${JSON.stringify(input)} must not throw`);
  check(kind === null, `malformed ${JSON.stringify(input)} is not media`);
}

check(
  mediaKindOfBlock({
    _repr: { type: "text" },
    properties: [{ name: "_repr", value: { type: "image" } }],
  }) === null,
  "direct non-media _repr wins over properties image",
);

check(
  mediaKindOfBlock({
    properties: [
      { name: "other", value: { type: "image" } },
      { name: "_repr", value: { type: "video" } },
    ],
  }) === "video",
  "skips non-_repr properties",
);

const EXPECTED_RAW: Record<MediaCardKind, number> = {
  image: MEDIA_CARD_HEIGHT_IMAGE,
  video: MEDIA_CARD_HEIGHT_VIDEO,
  audio: MEDIA_CARD_HEIGHT_AUDIO,
  pdf: MEDIA_CARD_HEIGHT_PDF,
  epub: MEDIA_CARD_HEIGHT_EPUB,
};

for (const kind of MEDIA_CARD_KINDS) {
  const size = mediaCardSize(kind);
  check(size.w >= MIN_CARD_WIDTH, `${kind} width >= MIN_CARD_WIDTH`);
  check(size.h >= MIN_CARD_HEIGHT, `${kind} height >= MIN_CARD_HEIGHT`);
  check(size.w === MEDIA_CARD_WIDTH, `${kind} width is the shared card width`);
  check(
    size.h === Math.max(MIN_CARD_HEIGHT, EXPECTED_RAW[kind]),
    `${kind} height is the named default, floored at MIN_CARD_HEIGHT`,
  );
}

check(
  mediaCardSize("audio").h === MIN_CARD_HEIGHT,
  "audio default is raised to MIN_CARD_HEIGHT",
);
check(
  MEDIA_CARD_HEIGHT_AUDIO < MIN_CARD_HEIGHT,
  "audio raw default is below the floor (documents the clamp)",
);

console.log("mediaCard.test.ts ok");
