import { type CanvasRenderingContext2D, createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { nodejsFn } from "./__generated__/create-nodejs-fn.runtime";

export const renderPdfPage = nodejsFn(async (url: string, pageNum: number, scale: number) => {
  const loadingTask = pdfjsLib.getDocument({ url });
  const pdfDoc = await loadingTask.promise;

  const page = await pdfDoc.getPage(pageNum);

  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const renderTask = page.render({ canvasContext: ctx, viewport } as any);
  await renderTask.promise;

  const dataUrlWebp = await canvas.toDataURLAsync("image/webp", 80);

  return dataUrlWebp;
});
