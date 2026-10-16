// @ts-nocheck
import { bitable } from '@base-open/web-api';
import './index.scss';

// 获取 HTML 标签
let btn = document.getElementById("btn");
let xT = document.getElementById("xTable");
let xV = document.getElementById("xView");
let xF = document.getElementById("xField");
let xNameMode = document.getElementById("xNameMode");
let xNameField = document.getElementById("xNameField");
let nameFieldLi = document.getElementById("nameFieldLi");
let mystatus = document.getElementById("mystatus");
let mask = document.getElementById("mask");

function setLoading(loading) {
  mask.hidden = !loading;
}

setLoading(true);
const selection = await bitable.base.getSelection();

// 存放数据表及对应字段信息
class MYTABLE {
  xtable;        // 表 meta
  xfields;       // 附件字段(type=17)
  allfields;     // 全部字段(用于命名字段选择)
  views;         // 视图 meta 列表 [{id,name,type}]
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

// 填充数据表下拉
fillSelect(xT, oTables);
xT.addEventListener("change", optUpdate);

// 命名方式切换：显示/隐藏命名字段选择
xNameMode.addEventListener("change", toggleNameField);
function toggleNameField() {
  nameFieldLi.style.display = (xNameMode.value === "field") ? "" : "none";
}
toggleNameField();

xT.value = oTables.find(({ id }) => id === selection.tableId).name;
optUpdate();
if (xF.options.length > 0) xF.value = xF.options['0'].value;

btn.addEventListener("click", async function () {
  mystatus.textContent = "start.......";
  let fcnt = 0;

  let oTN = xT.value;
  let oTable = await bitable.base.getTableByName(oTN);
  let oFN = getMultiValue();            // 需要导出的附件字段数组
  if (oFN.length === 0) {
    mystatus.textContent = "请先选择至少一个附件字段。";
    return;
  }

  // 命名方式
  let nameMode = xNameMode.value;       // origin | field
  let nameFieldName = (nameMode === "field") ? xNameField.value : null;
  let oNameField = null;
  if (nameMode === "field" && nameFieldName) {
    oNameField = await oTable.getFieldByName(nameFieldName);
  }

  // 记录范围：按所选视图的可见记录；取不到则回退整表
  let recordIds = await getRecordIdsByView(oTable, xV.value);

  for (let fi = 0; fi < oFN.length; fi++) {
    let oField = await oTable.getFieldByName(oFN[fi]);

    for (let i = 0; i < recordIds.length; i++) {
      let oCell = await oTable.getCellValue(oField.id, recordIds[i]);
      if (oCell != null) {
        // 该记录的命名字段值(字段命名模式)
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

          if (nameMode === "field") {
            let ext = getExt(oFileName);
            let base0 = baseName || stripExt(oFileName);
            let finalName = base0 + ext;
            if (oCell.length > 1) finalName = base0 + "_" + (j + 1) + ext;
            await downloadRenamed(oURL, finalName, oFileName);
          } else {
            myDownload({ file_url: oURL, file_name: oFileName });
          }
        }
      }
    }
  }

  mystatus.textContent = "已完成，共计" + fcnt + "个文件。";
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

// 数据表联动：更新视图 + 附件字段 + 命名字段
function optUpdate(e) {
  xF.options.length = 0;
  xNameField.options.length = 0;
  xV.options.length = 0;

  let sel1 = xT.value;
  if (sel1 != "0") {
    for (let j = 0; j < targetFields.length; j++) {
      if (sel1 === targetFields[j].xtable.name) {
        // 视图下拉（value=视图id，文本=视图名）
        let vs = targetFields[j].views || [];
        for (let v = 0; v < vs.length; v++) {
          let vopt = document.createElement("option");
          vopt.setAttribute("value", vs[v].id);
          vopt.textContent = vs[v].name;
          xV.appendChild(vopt);
        }
        // 默认选中当前选区的视图
        if (selection && selection.viewId) {
          for (let v = 0; v < xV.options.length; v++) {
            if (xV.options[v].value === selection.viewId) { xV.selectedIndex = v; break; }
          }
        }
        // 附件字段
        for (let k = 0; k < targetFields[j].xfields.length; k++) {
          let newopt = document.createElement("option");
          newopt.setAttribute("value", targetFields[j].xfields[k].name);
          newopt.textContent = targetFields[j].xfields[k].name;
          xF.appendChild(newopt);
        }
        // 命名字段：全部字段
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

// 根据视图 id 取可见记录；失败回退整表
async function getRecordIdsByView(oTable, viewId) {
  if (viewId) {
    try {
      let view = await oTable.getViewById(viewId);
      let ids = await view.getVisibleRecordIdList();
      // 过滤分组空行等 null
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

// 原生下载(原文件名模式，支持超大文件)
function myDownload(oFile) {
  let xlink = document.createElement("a");
  xlink.style.display = "none";
  xlink.href = oFile.file_url;
  xlink.setAttribute("download", oFile.file_name);
  document.body.appendChild(xlink);
  xlink.click();
  document.body.removeChild(xlink);
}

// 字段命名模式：fetch 读取后用自定义文件名保存；失败回退原生
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

function saveBlob(blob, filename) {
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

// 单元格值 -> 字符串(兼容文本/数字/单选/多选/人员等常见类型)
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

// 文件名非法字符处理
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
