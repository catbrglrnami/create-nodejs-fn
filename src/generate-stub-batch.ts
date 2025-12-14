import path from "node:path";
import { writeFileIfChanged } from "./fs-utils";

export function generateStubBatch(gdirAbs: string, generatedStubBatchFileName: string) {
  const filePath = path.join(gdirAbs, generatedStubBatchFileName);
  const content = `// Derived from Cloudflare's create-nodejs-fn helper implementation.
// Modifications: Use Durable Object stub.fetch() instead of global fetch().
//
// Copyright (c) 2025 Cloudflare, Inc.
// Licensed under the MIT license found in the LICENSE.txt file or at:
//     https://opensource.org/license/mit

import { RpcSession, type RpcSessionOptions, type RpcTransport } from "capnweb";
import type { RpcStub } from "cloudflare:workers";

type SendBatchFunc = (batch: string[]) => Promise<string[]>;

class BatchClientTransport implements RpcTransport {
  constructor(sendBatch: SendBatchFunc) {
    this.#promise = this.#scheduleBatch(sendBatch);
  }

  #promise: Promise<void>;
  #aborted: any;

  #batchToSend: string[] | null = [];
  #batchToReceive: string[] | null = null;

  async send(message: string): Promise<void> {
    if (this.#batchToSend !== null) {
      this.#batchToSend.push(message);
    }
  }

  async receive(): Promise<string> {
    if (!this.#batchToReceive) {
      await this.#promise;
    }

    const msg = this.#batchToReceive!.shift();
    if (msg !== undefined) return msg;

    throw new Error("Batch RPC request ended.");
  }

  abort?(reason: any): void {
    this.#aborted = reason;
  }

  async #scheduleBatch(sendBatch: SendBatchFunc) {
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (this.#aborted !== undefined) {
      throw this.#aborted;
    }

    const batch = this.#batchToSend!;
    this.#batchToSend = null;
    this.#batchToReceive = await sendBatch(batch);
  }
}

export function newHttpBatchRpcSession<T extends Rpc.Stubable>(
  stub: { fetch(request: Request): Promise<Response> },
  options?: RpcSessionOptions,
  path: string = "/api",
): RpcStub<T> {
  const sendBatch: SendBatchFunc = async (batch: string[]) => {
    const req = new Request(\`http://create-nodejs-fn\${path}\`, {
      method: "POST",
      body: batch.join("\\n"),
      headers: { "content-type": "text/plain; charset=utf-8" },
    });

    const response = await stub.fetch(req);

    if (!response.ok) {
      response.body?.cancel();
      throw new Error(\`RPC request failed: \${response.status} \${response.statusText}\`);
    }

    const body = await response.text();
    return body === "" ? [] : body.split("\\n");
  };

  const transport = new BatchClientTransport(sendBatch);
  const rpc = new RpcSession(transport, undefined, options);
  return rpc.getRemoteMain() as unknown as RpcStub<T>;
}

/*
MIT License

Copyright (c) 2025 Cloudflare, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
`;

  writeFileIfChanged(filePath, content.endsWith("\n") ? content : `${content}\n`);
}
