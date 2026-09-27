import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectVideoMimeType, isAllowedVideoBuffer } from "../../../src/utils/video-signature.util.js";

// A minimal-but-real MP4 "ftyp" box header: 4-byte box size, then ASCII
// "ftyp", then a major brand - this is what every real MP4 encoder
// (browsers' MediaRecorder, ffmpeg, phones) actually writes as the first
// bytes of the file, regardless of what Content-Type the upload used.
const REAL_MP4_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x18, // box size
  0x66, 0x74, 0x79, 0x70, // "ftyp"
  0x69, 0x73, 0x6f, 0x6d, // major brand "isom"
  0x00, 0x00, 0x02, 0x00,
]);

// The fixed 4-byte EBML magic number every real WebM/Matroska file opens
// with.
const REAL_WEBM_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);

// A PNG's real signature - stands in for "some other, non-video file whose
// uploader relabeled it with a video Content-Type".
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A PHP payload disguised as a video by the client's Content-Type header -
// the exact attack this check exists to stop: nothing about these bytes is
// a video, no matter what mimetype accompanies them.
const PHP_PAYLOAD = Buffer.from("<?php system($_GET['cmd']); ?>");

describe("video-signature.util - detectVideoMimeType", () => {
  it("recognizes a real MP4 by its ftyp box, independent of any claimed mimetype", () => {
    assert.equal(detectVideoMimeType(REAL_MP4_HEADER), "video/mp4");
  });

  it("recognizes a real WebM by its EBML magic number", () => {
    assert.equal(detectVideoMimeType(REAL_WEBM_HEADER), "video/webm");
  });

  it("returns null for a non-video file even with video-shaped intent (spoofed mimetype scenario)", () => {
    assert.equal(detectVideoMimeType(PNG_HEADER), null);
    assert.equal(detectVideoMimeType(PHP_PAYLOAD), null);
  });

  it("returns null for a too-short/empty buffer instead of throwing", () => {
    assert.equal(detectVideoMimeType(Buffer.alloc(0)), null);
    assert.equal(detectVideoMimeType(Buffer.from([0x00, 0x01])), null);
  });

  it("returns null for non-Buffer input instead of throwing", () => {
    assert.equal(detectVideoMimeType("not a buffer"), null);
    assert.equal(detectVideoMimeType(null), null);
    assert.equal(detectVideoMimeType(undefined), null);
  });
});

describe("video-signature.util - isAllowedVideoBuffer", () => {
  const ALLOWED = ["video/mp4", "video/webm"];

  it("accepts a real MP4 buffer against the allow-list", () => {
    assert.equal(isAllowedVideoBuffer(REAL_MP4_HEADER, ALLOWED), true);
  });

  it("accepts a real WebM buffer against the allow-list", () => {
    assert.equal(isAllowedVideoBuffer(REAL_WEBM_HEADER, ALLOWED), true);
  });

  it("rejects a spoofed upload (wrong actual bytes) even though a client could have sent video/mp4 as Content-Type", () => {
    assert.equal(isAllowedVideoBuffer(PHP_PAYLOAD, ALLOWED), false);
    assert.equal(isAllowedVideoBuffer(PNG_HEADER, ALLOWED), false);
  });

  it("rejects a real video format that isn't on this endpoint's allow-list", () => {
    assert.equal(isAllowedVideoBuffer(REAL_MP4_HEADER, ["video/webm"]), false);
  });
});
