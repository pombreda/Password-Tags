/*
    Password Tags, extension for Firefox and others
    Copyright (C) 2013  Daniel Dawson <ddawson@icehouse.net>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Cc = Components.classes, Ci = Components.interfaces,
      Cu = Components.utils;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://passwordtags/signonMetadataStorage.jsm");

function el (aEl) document.getElementById(aEl);

XPCOMUtils.defineLazyGetter(
  this, "sharedStrings",
  function () el("shared-strings"));
XPCOMUtils.defineLazyGetter(
  this, "strings",
  function () el("metadataeditor-strings"));
XPCOMUtils.defineLazyGetter(
  this, "prefs", function ()
    Cc["@mozilla.org/preferences-service;1"].
    getService(Ci.nsIPrefService).getBranch(""));
XPCOMUtils.defineLazyServiceGetter(
  this, "promptSvc",
  "@mozilla.org/embedcomp/prompt-service;1", "nsIPromptService");

var [signon, callback] = arguments,
    curMetadata = signonMetadataStorage.getMetadata(signon),
    gridRows = el("metadataeditor-gridrows"), rows = [];

function login () {
  var token = Cc["@mozilla.org/security/pk11tokendb;1"].
                createInstance(Ci.nsIPK11TokenDB).getInternalKeyToken();
  if (!token.checkPassword("")) {
    try {
      token.login(true);
    } catch (e) { }
    return token.isLoggedIn();
  }
  return true;
}

function getRowIndexFromButton (aEl)
  Number(aEl.parentElement.parentElement.parentElement.getAttribute("index"));

function getRowIndexFromField (aEl)
  Number(aEl.parentElement.parentElement.getAttribute("index"));

function removeField (aEvt) {
  var idx = getRowIndexFromButton(aEvt.target);
  gridRows.removeChild(rows[idx].row);
  rows.splice(idx, 1);

  if (idx == 0 && rows.length > 0)
    rows[idx].upBtn.setAttribute("disabled", "true");
  if (idx == rows.length && rows.length > 0)
    rows[idx - 1].downBtn.setAttribute("disabled", "true");

  for (let i = idx; i < rows.length; i++)
    rows[i].row.setAttribute("index", i);

  if (rows.length < 1) {
    el("encrypt-ck").hidden = true;
    el("metadataeditor-headerrow").hidden = true;
  }

  window.setTimeout(function () {
    if (idx < rows.length)
      rows[idx].nameFld.select();
    else if (rows.length > 0)
      rows[idx - 1].nameFld.select();
    else
      el("add-button").focus();
  }, 1);
}

function moveFieldUp (aEvt) {
  var idx = getRowIndexFromButton(aEvt.target);
  if (idx == 0) return;
  var hi = rows[idx - 1], lo = rows[idx];
  lo.downBtn.removeAttribute("disabled");
  if (idx == 1) lo.upBtn.setAttribute("disabled", "true");
  hi.upBtn.removeAttribute("disabled");
  if (idx == rows.length - 1)
    hi.downBtn.setAttribute("disabled", "true");
  lo.row.setAttribute("index", idx - 1);
  hi.row.setAttribute("index", idx);
  lo.upBtn.blur();
  var valueFld = rows[idx].valueFld;
  valueFld.setAttribute("value", valueFld.value);
  gridRows.insertBefore(lo.row, hi.row);
  rows.splice(idx - 1, 0, rows.splice(idx, 1)[0]);

  window.setTimeout(function () {
    if (idx > 1)
      lo.upBtn.focus();
    else
      lo.downBtn.focus();
  }, 1);
}

function moveFieldDown (aEvt) {
  var idx = getRowIndexFromButton(aEvt.target);
  if (idx == rows.length - 1) return;
  var hi = rows[idx], lo = rows[idx + 1];
  hi.upBtn.removeAttribute("disabled");
  if (idx == rows.length - 2)
    hi.downBtn.setAttribute("disabled", "true");
  lo.downBtn.removeAttribute("disabled");
  if (idx == 0) lo.upBtn.setAttribute("disabled", "true");
  hi.row.setAttribute("index", idx + 1);
  lo.row.setAttribute("index", idx);
  hi.downBtn.blur();
  var valueFld = rows[idx + 1].valueFld;
  valueFld.setAttribute("value", valueFld.value);
  gridRows.insertBefore(lo.row, hi.row);
  rows.splice(idx + 1, 0, rows.splice(idx, 1)[0]);

  window.setTimeout(function () {
    if (idx < rows.length - 2)
      hi.downBtn.focus();
    else
      hi.upBtn.focus();
  }, 1);
}

function selectFieldType (aEvt) {
  var idx = getRowIndexFromField(aEvt.target),
      row = rows[idx],
      type = row.typeLst.value,
      valueFld = row.valueFld;

  if (valueFld.hasAttribute("type")
      && valueFld.getAttribute("type") == "number")
    row.numVal = valueFld.value;
  else if (valueFld.hasAttribute("multiline")
           && valueFld.getAttribute("multiline") == "true")
    row.mlText = valueFld.value;
  else
    row.slText = valueFld.value;

  switch (type) {
  case "text":
    if (row.slText == null)
      row.slText = row.mlText != null ? row.mlText : row.numVal;

    valueFld.removeAttribute("type");
    valueFld.removeAttribute("multiline");
    valueFld.setAttribute("value", row.slText);
    break;

  case "mltext":
    if (row.mlText == null)
      row.mlText = row.slText != null ? row.slText : row.numVal;

    valueFld.removeAttribute("type");
    valueFld.setAttribute("multiline", "true");
    valueFld.setAttribute("value", row.mlText);
    break;

  case "number":
    valueFld.setAttribute("type", "number");
    valueFld.setAttribute("value", row.numVal);
    break;
  }
}

function addField () {
  el("encrypt-ck").hidden = false;
  el("metadataeditor-headerrow").hidden = false;

  var rowEntry = buildRow({
    name: sharedStrings.getString("newFieldName"),
    type: "text",
    value: ""
  }, rows.length, true);
  rows.push(rowEntry);
  gridRows.appendChild(rowEntry.row);
  if (rows.length > 1)
    rows[rows.length - 2].downBtn.removeAttribute("disabled");

  window.setTimeout(function () {
    rows[rows.length - 1].nameFld.select();
  }, 1);
}

function deleteAll () {
  var res = promptSvc.confirmEx(
    window,
    strings.getString("confirmDeleteAllFields.title"),
    strings.getString("confirmDeleteAllFields.msg"),
    promptSvc.STD_YES_NO_BUTTONS + promptSvc.BUTTON_DELAY_ENABLE,
    null, null, null, null, {});

  if (res != 0) return;

  rows = [];
  var cur = gridRows.children[1];
  while (cur) {
    let next = cur.nextElementSibling;
    gridRows.removeChild(cur);
    cur = next;
  }

  el("encrypt-ck").hidden = true;
  el("metadataeditor-headerrow").hidden = true;

  window.setTimeout(function () {
    el("add-button").focus();
  }, 1);
}

function writeMetadata () {
  var md = new SignonMetadata();
  md.tags = el("tags-field").value;
  md.metadataType = el("encrypt-ck").checked ? 1 : 0;
  for (let i = 0; i < rows.length; i++)
    md.insertField(-1, rows[i].nameFld.value, rows[i].typeLst.value,
                   rows[i].valueFld.value);
  signonMetadataStorage.setMetadata(signon, md);
}

function buildRow (aField, aIdx, aIsLast) {
  let rowEntry = {};

  let row = document.createElement("row");
  rowEntry.row = row;
  row.setAttribute("index", aIdx);
  let vbox = document.createElement("vbox");
  let hbox = document.createElement("hbox");
  let btn = document.createElement("button");
  btn.classList.add("remove-button");
  btn.setAttribute("tooltiptext", sharedStrings.getString("remove.tooltip"));
  btn.addEventListener("command", removeField, false);
  hbox.appendChild(btn);
  vbox.appendChild(hbox);
  let spc = document.createElement("spacer");
  spc.setAttribute("flex", "1");
  vbox.appendChild(spc);
  hbox = document.createElement("hbox");
  btn = document.createElement("button");
  rowEntry.upBtn = btn;
  btn.classList.add("up-button");
  btn.setAttribute("tooltiptext", sharedStrings.getString("moveUp.tooltip"));
  btn.addEventListener("command", moveFieldUp, false);
  if (aIdx == 0) btn.setAttribute("disabled", "true");
  hbox.appendChild(btn);
  btn = document.createElement("button");
  rowEntry.downBtn = btn;
  btn.classList.add("down-button");
  btn.setAttribute("tooltiptext",
                   sharedStrings.getString("moveDown.tooltip"));
  btn.addEventListener("command", moveFieldDown, false);
  if (aIsLast) btn.setAttribute("disabled", "true");
  hbox.appendChild(btn);
  vbox.appendChild(hbox);
  spc = document.createElement("spacer");
  spc.setAttribute("flex", "1");
  vbox.appendChild(spc);
  row.appendChild(vbox);

  vbox = document.createElement("vbox");
  let fld = document.createElement("textbox");
  rowEntry.nameFld = fld;
  fld.setAttribute("size", "1");
  fld.setAttribute("tooltiptext",
                   sharedStrings.getString("nameField.tooltip"));
  fld.setAttribute("value", aField.name);
  vbox.appendChild(fld);

  let lst = document.createElement("menulist");
  rowEntry.typeLst = lst;
  lst.setAttribute("value", aField.type);
  lst.setAttribute("tooltiptext",
                   sharedStrings.getString("typeList.tooltip"));
  let pop = document.createElement("menupopup");
  let item = document.createElement("menuitem");
  item.setAttribute("label", sharedStrings.getString("type_text.label"));
  item.setAttribute("tooltiptext",
                    sharedStrings.getString("type_text.tooltip"));
  item.setAttribute("value", "text");
  pop.appendChild(item);
  item = document.createElement("menuitem");
  item.setAttribute("label", sharedStrings.getString("type_mltext.label"));
  item.setAttribute("tooltiptext",
                    sharedStrings.getString("type_mltext.tooltip"));
  item.setAttribute("value", "mltext");
  pop.appendChild(item);
  item = document.createElement("menuitem");
  item.setAttribute("label", sharedStrings.getString("type_number.label"));
  item.setAttribute("tooltiptext",
                    sharedStrings.getString("type_number.tooltip"));
  item.setAttribute("value", "number");
  pop.appendChild(item);
  lst.appendChild(pop);
  lst.addEventListener("select", selectFieldType, false);
  vbox.appendChild(lst);
  row.appendChild(vbox);

  vbox = document.createElement("vbox");
  fld = document.createElement("textbox");
  rowEntry.valueFld = fld;
  fld.setAttribute("tooltiptext", strings.getString("valueField.tooltip"));
  if (aField.type == "number") fld.setAttribute("type", "number");
  fld.setAttribute("multiline", aField.type == "mltext" ? "true" : "false");
  fld.setAttribute("rows", "4");
  fld.setAttribute("decimalplaces", "Infinity");
  fld.setAttribute("min", "-Infinity");
  fld.setAttribute("value", aField.value);
  vbox.appendChild(fld);
  row.appendChild(vbox);
  rowEntry.slText = aField.type == "text" ? aField.value : null;
  rowEntry.mlText = aField.type == "mltext" ? aField.value : null;
  rowEntry.numVal = aField.type == "number" ? aField.value : "0";

  return rowEntry;
}

function configDefaultFields () {
  var features = "chrome,titlebar,toolbar,centerscreen";
  try {
    let instantApply = prefs.getBoolPref("browser.preferences.instantApply");
    features += instantApply ? ",dialog=no" : ",modal";
  } catch (e) {
    features += ",modal";
  }

  openDialog("chrome://passwordtags/content/prefwindow.xul", "", features,
             "defaultfieldconfig");
}

function init () {
  if (curMetadata.metadataType > 0
      && prefs.getBoolPref(
           "extensions.passwordtags.promptMasterPwdForEncrMetadata")
      && !login()) {
    window.close();
    return;
  }

  el("current-host").setAttribute(
    "value",
    signon.hostname + (signon.httpRealm ? " (" + signon.httpRealm + ")" : ""));
  el("current-submitprefix").setAttribute(
    "value", signon.formSubmitURL ? signon.formSubmitURL : "");
  el("current-username").setAttribute("value", signon.username);

  el("tags-field").setAttribute("value", curMetadata.tags);
  el("encrypt-ck").setAttribute(
    "checked",
    curMetadata.metadataType > 0
      || (curMetadata.metadataType == -1
          && prefs.getBoolPref(
               "extensions.passwordtags.encryptMetadataByDefault")));

  if (curMetadata.metadata.length == 0) {
    el("encrypt-ck").hidden = true;
    el("metadataeditor-headerrow").hidden = true;
  }

  for (let i = 0; i < curMetadata.metadata.length; i++) {
    let rowEntry = buildRow(curMetadata.getField(i), i,
                            i == curMetadata.metadata.length - 1);
    rows.push(rowEntry);
    gridRows.appendChild(rowEntry.row);
  }
}

init();
