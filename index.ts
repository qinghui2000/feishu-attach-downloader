// @ts-nocheck
import { bitable } from '@base-open/web-api';
import JSZip from 'jszip';
import './index.scss';

// 获取 HTML 标签
let btn = document.getElementById("btn");
let xT = document.getElementById("xTable");
let xV = document.getElementById("xView");
let xF = document.getElementById("xField");
let xNameMode = document.getElementById("xNameMode");
let xNameField = document.getElementById("xNameField");
let nameFieldLi = document.getElementById("nameFieldLi");
let xDownMode = document.getElementById("xDownMode");
let mystatus = document.getElementById("mystatus");
let mask = document.getElementById("mask");

function setLoading(loading) {
  mask.hidden = !loading;
}

setLoading(true);
const selection = await bitable.base.getSelection();

class MYTABLE {
  xtable;
  xfields;
  allfields;
  views;
}

let targetFields = [];
let oTables = await bitable.base.getTableMetaList();

for (let i = 0; i < oTables.length; i++) {
  let cTable = await bitable.base.getTableById(oTables[i].id);
  let cFields = await cTable.getFieldMetaList();
  let aFields = cFields.filter(fTypeCheck);
  let vMetas = [];
  try {
    vMetas = await cTable.getViewMetaList();
  } catch (e) {
    vMetas = [];
  }
  let temp = new MYTABLE();
  temp.xtable = oTables[i];
  temp.xfields = aFields;
  temp.allfields = cFields;
  temp.views = vMetas;
  targetFields.push(temp);
}

fillSelect(xT, oTables);
xT.addEventListener("change", optUpdate);

xNameMode.addEventListener("change", toggleNameField);
function toggleNameField() {
  nameFieldLi.style.display = (xNameMode.value === "field") ? "" : "none";
}
toggleNameField();

xT.value = oTables.find(({ id }) => id === selection.tableId).name;
optUpdate();
if (xF.options.length > 0) xF.value = xF.options['0'].value;

btn.addEventListener("click", async function () {
  btn.disabled = true;
  mystatus.textContent = "开始处理…";
  try {
    let oTN = xT.value;
    let oTable = await bitable.base.getTableByName(oTN);
    let oFN = getMultiValue();
    if (oFN.length === 0) {
      mystatus.textContent = "请先选择至少一个附件字段。";
      return;
    }

    let nameMode = xNameMode.value;       // origin | field
    let downMode = xDownMode.value;       // single | zip
    let nameFieldName = (nameMode === "field") ? xNameField.value : null;
    let oNameField = null;
    if (nameMode === "field" && nameFieldName) {
      oNameField = await oTable.getFieldByName(nameFieldName);
    }

    let recordIds = await getRecordIdsByView(oTable, xV.value);

    // 先收集所有待下载项(url + 文件名)
    let items = [];   // {url, name}
    let fcnt = 0;
    for (let fi = 0; fi < oFN.length; fi++) {
      let oField = await oTable.getFieldByName(oFN[fi]);
      for (let i = 0; i < recordIds.length; i++) {
        let oCell = await oTable.getCellValue(oField.id, recordIds[i]);
        if (oCell != null) {
          let baseName = "";
          if (nameMode === "field" && oNameField) {
            let nv = await oTable.getCellValue(oNameField.id, recordIds[i]);
            baseName = safeName(cellToStr(nv));
          }
          fcnt = fcnt + oCell.length;
          for (let j = 0; j < oCell.length; j++) {
            let oToken = oCell[j].token;
            let oFileName = oCell[j].name;
            let oURL = await oTable.getAttachmentUrl(oToken, oField.id, recordIds[i]);
            let finalName;
            if (nameMode === "field") {
              let ext = getExt(oFileName);
              let base0 = baseName || stripExt(oFileName);
              finalName = (oCell.length > 1) ? (base0 + "_" + (j + 1) + ext) : (base0 + ext);
            } else {
              finalName = oFileName;
            }
            items.push({ url: oURL, name: finalName });
          }
        }
      }
    }

    if (items.length === 0) {
      mystatus.textContent = "没有找到可下载的附件。";
      return;
    }

    if (downMode === "zip") {
      await downloadAsZip(items, oTN);
    } else {
      // 逐个下载
      for (let k = 0; k < items.length; k++) {
        if (nameMode === "field") {
          await downloadRenamed(items[k].url, items[k].name, items[k].name);
        } else {
          myDownload({ file_url: items[k].url, file_name: items[k].name });
        }
        mystatus.textContent = "逐个下载中… " + (k + 1) + "/" + items.length;
      }
      mystatus.textContent = "已完成，共计" + fcnt + "个文件。";
    }
  } catch (e) {
    mystatus.textContent = "出错：" + (e && e.message ? e.message : e);
  } finally {
    btn.disabled = false;
  }
});

setLoading(false);

// ---------- 工具函数 ----------

function fillSelect(tMark, mArray) {
  for (let i = 0; i < mArray.length; i++) {
    let temp = document.createElement("option");
    temp.setAttribute("value", mArray[i].name);
    temp.textContent = mArray[i].name;
    tMark.appendChild(temp);
  }
}

function optUpdate(e) {
  xF.options.length = 0;
  xNameField.options.length = 0;
  xV.options.length = 0;

  let sel1 = xT.value;
  if (sel1 != "0") {
    for (let j = 0; j < targetFields.length; j++) {
      if (sel1 === targetFields[j].xtable.name) {
        let vs = targetFields[j].views || [];
        for (let v = 0; v < vs.length; v++) {
          let vopt = document.createElement("option");
          vopt.setAttribute("value", vs[v].id);
          vopt.textContent = vs[v].name;
          xV.appendChild(vopt);
        }
        if (selection && selection.viewId) {
          for (let v = 0; v < xV.options.length; v++) {
            if (xV.options[v].value === selection.viewId) { xV.selectedIndex = v; break; }
          }
        }
        for (let k = 0; k < targetFields[j].xfields.length; k++) {
          let newopt = document.createElement("option");
          newopt.setAttribute("value", targetFields[j].xfields[k].name);
          newopt.textContent = targetFields[j].xfields[k].name;
          xF.appendChild(newopt);
        }
        for (let k = 0; k < targetFields[j].allfields.length; k++) {
          let f = targetFields[j].allfields[k];
          let nameopt = document.createElement("option");
          nameopt.setAttribute("value", f.name);
          nameopt.textContent = f.name;
          xNameField.appendChild(nameopt);
        }
      }
    }
  }
}

async function getRecordIdsByView(oTable, viewId) {
  if (viewId) {
    try {
      let view = await oTable.getViewById(viewId);
      let ids = await view.getVisibleRecordIdList();
      ids = (ids || []).filter(function (x) { return x != null; });
      if (ids.length > 0) return ids;
    } catch (e) { /* 回退 */ }
  }
  return await oTable.getRecordIdList();
}

function fTypeCheck(m) {
  if (m.type === 17) {
    return m;
  }
}

function getMultiValue() {
  let multiV = [];
  let mseled = xF.selectedOptions;
  for (let i = 0; i < mseled.length; i++) {
    multiV.push(mseled[i].value);
  }
  return multiV;
}

// 原生下载(逐个, 原文件名模式, 支持超大文件)
function myDownload(oFile) {
  let xlink = document.createElement("a");
  xlink.style.display = "none";
  xlink.href = oFile.file_url;
  xlink.setAttribute("download", oFile.file_name);
  document.body.appendChild(xlink);
  xlink.click();
  document.body.removeChild(xlink);
}

// 逐个 + 字段命名: fetch 后用自定义名保存
async function downloadRenamed(url, finalName, origName) {
  try {
    let resp = await fetch(url);
    if (!resp.ok) throw new Error("http " + resp.status);
    let blob = await resp.blob();
    saveBlob(blob, finalName);
  } catch (e) {
    myDownload({ file_url: url, file_name: finalName || origName });
  }
}

// 打包 ZIP 下载
async function downloadAsZip(items, tableName) {
  let zip = new JSZip();
  let used = {};
  let failed = 0;
  for (let k = 0; k < items.length; k++) {
    mystatus.textContent = "读取文件中… " + (k + 1) + "/" + items.length;
    try {
      let resp = await fetch(items[k].url);
      if (!resp.ok) throw new Error("http " + resp.status);
      let blob = await resp.blob();
      let name = uniqueName(used, items[k].name || ("file_" + (k + 1)));
      zip.file(name, blob);
    } catch (e) {
      failed++;
    }
  }
  mystatus.textContent = "正在打包压缩…";
  let content = await zip.generateAsync(
    { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
    function (meta) {
      mystatus.textContent = "正在打包压缩… " + Math.round(meta.percent) + "%";
    }
  );
  let zipName = safeName(tableName || "附件") + "_" + tsStr() + ".zip";
  saveBlob(content, zipName);
  mystatus.textContent = "已完成，共打包 " + (items.length - failed) + " 个文件" +
    (failed > 0 ? ("，" + failed + " 个失败") : "") + "。";
}

// zip 内重名处理：a.pdf -> a(1).pdf
function uniqueName(used, name) {
  if (!used[name]) { used[name] = 1; return name; }
  let ext = getExt(name);
  let base0 = stripExt(name);
  let n = used[name];
  let cand;
  do {
    cand = base0 + "(" + n + ")" + ext;
    n++;
  } while (used[cand]);
  used[name] = n;
  used[cand] = 1;
  return cand;
}

function saveBlob(blob, filename) {
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

function cellToStr(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    return v.map(function (seg) {
      if (seg == null) return "";
      if (typeof seg === "string") return seg;
      if (typeof seg === "number") return String(seg);
      return (seg.text != null ? seg.text
            : seg.name != null ? seg.name
            : seg.enName != null ? seg.enName
            : seg.id != null ? seg.id : "");
    }).join("").trim();
  }
  if (typeof v === "object") {
    return (v.text != null ? v.text
          : v.name != null ? v.name
          : v.enName != null ? v.enName
          : v.id != null ? v.id : "").toString();
  }
  return String(v);
}

function safeName(s) {
  if (s == null) return "";
  return String(s).replace(/[\\/:*?"<>|\r\n\t]/g, "_").replace(/\s+/g, " ").trim();
}

function getExt(name) {
  if (!name) return "";
  let i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : "";
}

function stripExt(name) {
  if (!name) return "";
  let i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(0, i) : name;
}

function tsStr() {
  let d = new Date();
  function p(n) { return n < 10 ? "0" + n : "" + n; }
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
