// @ts-nocheck
import { bitable } from '@base-open/web-api';
import './index.scss';

//获取HTML的标签内容
let oF = document.getElementById("oField");
let btn = document.getElementById("btn");
let xT = document.getElementById("xTable");
let xF = document.getElementById("xField");
let mystatus = document.getElementById("mystatus");
let mask = document.getElementById("mask");

function setLoading(loading) {
  mask.hidden = !loading;
}

setLoading(true);
// 刚渲染本插件的时候所选的tableId等信息
const selection = await bitable.base.getSelection();

//定义一个类型，用于存放筛选出的数据表及对应的附件字段
class MYTABLE {
  xtable;
  xfields
}

//定义存放单个文件地址、文件名的类
class MYFILE {
  file_url;
  file_name
}


//定义存放数据表中附件字段信息的数组
let targetFields = [];
//获取当前多维表的数据表清单，以及各个数据表中包含有附件的字段内容
let oTables = await bitable.base.getTableMetaList();
console.log(oTables);

//针对每个数据表，检查获取其中的附件类型的字段
for (let i = 0; i < oTables.length; i++) {
  let cTable = await bitable.base.getTableById(oTables[i].id);
  let cFields = await cTable.getFieldMetaList();

  //将cFields中的type=17（类型为附件）的内容过滤出来.
  let aFields = cFields.filter(fTypeCheck);
  //创建一个对象，存放数据表及对应的附件字段信息
  let temp = new MYTABLE();
  temp.xtable = oTables[i];
  temp.xfields = aFields;
  //将temp压到数组中
  targetFields.push(temp);
}
console.log(targetFields);
//将字段信息填充到select标记中
//将数据表信息填充到select
fillSelect(xT, oTables);

//为select添加事件监听onchange，选择不同的数据表时，联动fields内容变更
xT.addEventListener("change", optUpdate);

xT.value = oTables.find(({ id }) => id === selection.tableId).name;
optUpdate()
xF.value = xF.options['0'].value

//为按钮添加click监听
btn.addEventListener("click", async function() {
  mystatus.textContent = "start.......";
  //待下载文件计数器初始化
  let fcnt = 0;
  //定义一个数组，用于存放取出来的URL地址和文件名
  let myFiles = [];
  //获取数据表名称和字段名称
  let oTN = xT.value;
  //获得需要操作的数据表
  let oTable = await bitable.base.getTableByName(oTN);
  let oFN = getMultiValue();//需要导出的字段是一个数组
  //对字段进行遍历
  for (let fi = 0; fi < oFN.length; fi++) {
    //获取需要操作的字段对象
    let oField = await oTable.getFieldByName(oFN[fi]);
    //获取记录条目数组
    let oRecordList = await oTable.getRecordIdList();
    //对oField字段中每一条Record进行循环，若不为空，则将其中的token取出，获取URL，进行下载
    for (let i = 0; i < oRecordList.length; i++) {
      let oCell = await oTable.getCellValue(oField.id, oRecordList[i]);
      if (oCell != null) {
        //将文件数量记录到计数器中
        fcnt = fcnt + oCell.length;
        //一个单元格内可能有多个附件
        for (let j = 0; j < oCell.length; j++) {
          let oToken = oCell[j].token;
          let oFileName = oCell[j].name;
          let oURL = await oTable.getAttachmentUrl(oToken, oField.id, oRecordList[i]);
          //将获得的URL和文件名存放到一个文件对象中
          let myFile = new MYFILE();
          myFile.file_url = oURL;
          myFile.file_name = oFileName;
          //将该对象添加到数组中
          myFiles.push(myFile);
          myDownload(myFile);
        }
      }
    }

  }

  mystatus.textContent = "已完成，共计" + fcnt + "个文件。";
});


setLoading(false)

//将获得的数组信息填充到select标记的option中的函数
function fillSelect(tMark, mArray) {
  for (let i = 0; i < mArray.length; i++) {
    let temp = document.createElement("option");
    temp.setAttribute("value", mArray[i].name);
    temp.textContent = mArray[i].name;
    tMark.appendChild(temp);
  }
}


//从数据表选择联动附件字段的函数，更新字段选项信息
function optUpdate(e) {
  //对xF中的option清空。
  xF.options.length = 0;

  //console.log(xF.getElementsByTagName("option"));
  //获取xT的值
  let sel1 = xT.value;
  if (sel1 != "0") {
    //用sel1的值去targetFields[j].xtable.name中查找对应名称的数据表
    for (let j = 0; j < targetFields.length; j++) {
      if (sel1 === targetFields[j].xtable.name) {
        //如果符合当前选择的数据表名称，取其中的xfields的名称，创建option。
        for (let k = 0; k < targetFields[j].xfields.length; k++) {
          let newopt = document.createElement("option");
          newopt.setAttribute("value", targetFields[j].xfields[k].name);
          newopt.textContent = targetFields[j].xfields[k].name;
          xF.appendChild(newopt);
        }
      }
    }
  }
}

//从数组种筛选type=17的内容函数
function fTypeCheck(m) {
  if (m.type === 17) {
    return m;
  }
}

//获取下拉多选内容的函数
function getMultiValue() {
  let multiV = [];
  let mseled = xF.selectedOptions;
  for (let i = 0; i < mseled.length; i++) {
    multiV.push(mseled[i].value);
    //console.log(mseled[i].selected); // 必定是true
    //console.log(mseled[i].value);  // 选中的option的值
  }
  return multiV;
}



//根据URL、文件名，模拟生成HTML的标签，并点击下载的函数
function myDownload(oFile) {

  let xlink = document.createElement("a"); // 创建一个 a 标签用来模拟点击事件	
  xlink.style.display = "none";
  xlink.href = oFile.file_url;
  xlink.setAttribute("download", oFile.file_name);
  document.body.appendChild(xlink);
  xlink.click();
  document.body.removeChild(xlink);

}