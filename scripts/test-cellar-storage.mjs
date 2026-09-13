// DBや本番データには接続しない回帰テスト。実行: node --test scripts/test-cellar-storage.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 既存のTypeScriptをそのまま検査し、認証・DB・写真操作だけを差し替える。
function loader(mocks = {}) {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const output = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: path,
    }).outputText;
    const loadedModule = { exports: {} };
    cache.set(path, loadedModule.exports);
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
      const base = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(path), name);
      const target = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
      if (!target) throw new Error(`Module not found: ${name}`);
      return load(target);
    };
    runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: path })(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return (file) => load(resolve(root, file));
}

const load = loader();
const { cellarFromRow } = load("app/lib/wine-mappers.ts");
const wine = cellarFromRow({ id: "test-wine", name: "テストワイン", quantity: 2 });

test("旧データは自宅、保管先は購入元・家族の飲用状態とは独立", () => {
  assert.equal(wine.storageLocation, "home");
  const stored = cellarFromRow({ purchase_source: "別のお店", storage_location: "enoteca", drink_status: "recorded" });
  assert.equal(stored.storageLocation, "enoteca");
  assert.equal(stored.purchaseSource, "別のお店");
  assert.equal(stored.drinkStatus, "recorded");
});

function apiHarness(authenticated = true) {
  const queries = [];
  const mockedLoad = loader({
    "@/app/lib/api-auth": {
      getRequestUser: () => authenticated ? { id: "test-user" } : null,
      unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
    },
    "@/app/lib/db": { getSql: () => async (parts, ...values) => {
      queries.push({ parts, values });
      return [{ id: "test-wine", name: "テストワイン", photos: [], storage_location: "enoteca" }];
    } },
    "@/app/lib/photo-cleanup": { deletePhotosIfUnreferenced: async () => {} },
  });
  return { queries, ...mockedLoad("app/api/cellar/route.ts"), ...mockedLoad("app/api/cellar/[id]/route.ts") };
}

for (const method of ["POST", "PUT"]) {
  for (const location of [undefined, "home", "enoteca"]) {
    test(`${method}: 保管先 ${String(location)}`, async () => {
      const api = apiHarness();
      const response = await api[method]({ json: async () => ({ ...wine, storageLocation: location }) }, { params: Promise.resolve({ id: wine.id }) });
      assert.equal(response.status, 200);
      const query = api.queries.at(-1);
      if (method === "POST") {
        const columns = query.parts[0].match(/insert into cellar_wines \(([\s\S]*?)\)/)[1].split(",").map((c) => c.trim());
        // household_id comes from hm.household_id rather than a bound parameter.
        assert.equal(query.values[columns.indexOf("storage_location") - 1], location ?? "home");
      } else {
        const index = query.parts.findIndex((part) => part.endsWith("storage_location = coalesce("));
        assert.ok(index >= 0);
        assert.equal(query.values[index], location ?? null);
        assert.match(query.parts[index + 1], /^, storage_location\)/);
      }
      assert.match(query.parts.join("?"), /household_members/);
    });
  }
  test(`${method}: 不正な保管先をDB操作前に拒否`, async () => {
    for (const storageLocation of ["other", "", null, 123]) {
      const api = apiHarness();
      const response = await api[method]({ json: async () => ({ storageLocation }) }, { params: Promise.resolve({ id: wine.id }) });
      assert.equal(response.status, 400);
      assert.equal(api.queries.length, 0);
    }
  });
  test(`${method}: 未認証では保存不可`, async () => {
    const api = apiHarness(false);
    const response = await api[method]({}, { params: Promise.resolve({ id: wine.id }) });
    assert.equal(response.status, 401);
    assert.equal(api.queries.length, 0);
  });
}

const uiLoad = loader({
  "./WineForm": { COUNTRIES: [] },
  "./PhotoUpload": { PhotoUpload: () => null },
  "@/app/lib/offline-store": { loadDraft: () => null, saveDraft: () => {}, clearDraft: () => {} },
});
const { CellarForm } = uiLoad("app/components/CellarForm.tsx");
const { CellarCard } = uiLoad("app/components/CellarCard.tsx");
const noop = () => {};

test("新規登録・旧データ編集は自宅、エノテカ編集は選択状態を保持", () => {
  for (const initial of [undefined, { ...wine, storageLocation: undefined }, { ...wine, storageLocation: "enoteca" }]) {
    const html = renderToStaticMarkup(React.createElement(CellarForm, { initial, onSubmit: noop, onCancel: noop }));
    const expected = initial?.storageLocation ?? "home";
    assert.match(html, new RegExp(`<option value="${expected}" selected="">`));
    assert.match(html, /<label for="[^"]+"[^>]*>保管先<\/label>/);
  }
});

test("エノテカのみラベル表示、飲用済みボタンを再表示しない", () => {
  for (const storageLocation of [undefined, "home", "enoteca"]) {
    const html = renderToStaticMarkup(React.createElement(CellarCard, {
      wine: { ...wine, storageLocation, drinkStatus: "recorded" }, onEdit: noop, onDelete: noop, onDrink: noop,
    }));
    assert.equal(html.includes("保管先：エノテカセラー"), storageLocation === "enoteca");
    assert.ok(!html.includes("自宅セラー"));
    assert.doesNotMatch(html, />飲む</);
  }
});
