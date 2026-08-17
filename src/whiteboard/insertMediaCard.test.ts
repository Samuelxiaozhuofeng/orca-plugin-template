import {
  acceptForMediaKind,
  mediaBlockRepr,
  mediaBlockText,
  uploadedAssetSrc,
  type MediaKind,
} from "./insertMediaCard.ts";

function check(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

const KINDS: readonly MediaKind[] = ["pdf", "epub", "video", "audio", "image"];

for (const kind of KINDS) {
  const src = `./sample-${kind}.bin`;
  const repr = mediaBlockRepr(kind, src);
  check(repr.type === kind, `${kind} repr type`);
  check(repr.src === src, `${kind} repr src is used as-is`);
  check(
    mediaBlockText(kind, src) === `${kind}: ${src}`,
    `${kind} block text uses kind prefix`,
  );
}

check(
  acceptForMediaKind("pdf") === "application/pdf,.pdf",
  "pdf accept lists mime and extension",
);
check(
  acceptForMediaKind("epub").includes(".epub"),
  "epub accept includes .epub fallback",
);
check(
  acceptForMediaKind("epub") ===
    "application/epub+zip,application/epub,.epub",
  "epub accept lists both mimes and extension",
);
check(acceptForMediaKind("video") === "video/*", "video accept is video/*");
check(acceptForMediaKind("audio") === "audio/*", "audio accept is audio/*");
check(acceptForMediaKind("image") === "image/*", "image accept is image/*");

check(
  uploadedAssetSrc({ uploaded: ["./a.pdf"], failed: [] }) === "./a.pdf",
  "valid upload result yields first src",
);
check(
  uploadedAssetSrc({ uploaded: [], failed: ["/x"] }) === null,
  "empty uploaded list is null",
);
check(uploadedAssetSrc(null) === null, "null upload result is null");
check(uploadedAssetSrc(undefined) === null, "undefined upload result is null");
check(uploadedAssetSrc({}) === null, "empty object is null");
check(
  uploadedAssetSrc({ uploaded: "x" }) === null,
  "non-array uploaded is null",
);
check(
  uploadedAssetSrc({ uploaded: [""], failed: [] }) === null,
  "empty uploaded string is null",
);
check(
  uploadedAssetSrc({ uploaded: [42], failed: [] }) === null,
  "non-string uploaded entry is null",
);

console.log("insertMediaCard.test.ts ok");
