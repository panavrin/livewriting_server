/*
(c) Copyright 2014-2015  Sang Won Lee sangwonlee717@gmail.com
All rights reserved.
*/

/*jslint browser: true*/
/*global $, jQuery, alert*/
/*global define */
var DEBUG = false;
var snapshotReplay = true;
/* ****
live writing requires jQuery and jQuery-ui
*/
if(typeof require != "undefined"){
  try {
    jQuery = require('jquery');
    require('jquery-ui');
  }
  catch (e) {
    console.error("require error. ")
  }
}

var lw_jQuery = jQuery;
if (typeof lw_jQuery == "undefined"){
  if(typeof $ != "undefined"){
    lw_jQuery = $;
  }
}


if ( typeof lw_jQuery == "undefined"){
  console.error("Live Writing API requires jQuery.")
}
else{
  if(DEBUG)console.log("jQuery detected live writing running ");



  var livewriting = (function ($) {
  "use strict";

      //Get ip address
      var ip;
      $.get('https://www.cloudflare.com/cdn-cgi/trace', function(data){
        ip = data.split('\n')[2].slice(3)});

      var INSTANTPLAYBACK = false,
      SLIDER_UPDATE_INTERVAL = 100,
      INACTIVE_SKIP_THRESHOLD = 2000,
      SKIP_RESUME_WARMUP_TIME = 1000,
      CM_MARKER_CLEAR_TIME = 1000,
      randomcolor = [ "#c0c0f0", "#f0c0c0", "#c0f0c0", "#f090f0", "#90f0f0", "#f0f090"],
      lw_histogram_bin_number = 480,
      canvas_histogram_width = 480,
      canvas_histogram_height = 50,
      keyup_debug_color_index=0,
      keydown_debug_color_index=0,
      keypress_debug_color_index=0,
      mouseup_debug_color_index=0,
      double_click_debug_color_index=0,
      nonTypingKey={// this keycode is from http://css-tricks.com/snippets/javascript/javascript-keycodes/
      BACKSPACE:8,
      TAB:9,
      ENTER:13,
      SHIFT:16,
      CTRL:17,
      ALT:18,
      PAUSE_BREAK:19,
      CAPS_LOCK:20,
      ESCAPE: 27,
      SPACE: 32,
      PAGE_UP: 33,
      PAGE_DOWN: 34,
      END: 35,
      HOME: 36,
      LEFT_ARROW: 37,
      UP_ARROW: 38,
      RIGHT_ARROW: 39,
      DOWN_ARROW: 40,
      INSERT: 45,
      DELETE: 46},
      getUrlVars =  function(){
          var vars = [], hash;
          var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
          for(var i = 0; i < hashes.length; i++)
          {
              hash = hashes[i].split('=');
              vars.push(hash[0]);
              vars[hash[0]] = hash[1];
          }
          return vars;
      },
      //Interaction tracing
      interactionTrace = function (logObj){
      //Receives a log obj: {event:"event type"}, and any additional data
      //Adds timestamp, aid, and IP address
      //Posts logObj to mongoDB server
      logObj.timestamp = (new Date()).getTime();
      logObj.aid = getUrlVar('aid');
      logObj.ip = ip;
      $.ajax({
        url:'/interactiontracing', 
        type:"post", 
        data:JSON.stringify(logObj), contentType:"text/plain"
      });
      if (DEBUG) console.log('Logged Interaction:' + logObj);
      },
      setCursorPosition = function(input, selectionStart, selectionEnd) {
          if (input.setSelectionRange) {
              input.focus();
              input.setSelectionRange(selectionStart, selectionEnd);
          }
          else if (input.createTextRange) {
              var range = input.createTextRange();
              range.collapse(true);
              range.moveEnd('character', selectionEnd);
              range.moveStart('character', selectionStart);
              range.select();
          }
      },
      getUrlVar =  function(name){
          return getUrlVars()[name];
      },
      getChar = function (event) {
        if (event.which == null) {
          return String.fromCharCode(event.keyCode) // IE
        } else if (event.which!=0 && event.charCode!=0) {
          return String.fromCharCode(event.which)   // the rest
        } else {
          return null // special key
        }
      },
      getCursorTextAreaPosition = function () {
          var el = this,
              pos = {};
          if (typeof el.selectionStart == "number" &&
              typeof el.selectionEnd == "number") {
              pos[0] = el.selectionStart;
              pos[1] = el.selectionEnd;
          } else if ('selection' in document) {
              // have not checked in IE browsers
              el.focus();
              var Sel = document.selection.createRange(),
                  SelLength = document.selection.createRange().text.length;
              Sel.moveStart('character', -el.value.length);
              pos[0] = Sel.text.length - SelLength;
              pos[1] = Sel.text.length - SelLength;
          }
          return pos;
      },
      isCaretMovingKey = function(keycode){
          return (keycode == nonTypingKey["LEFT_ARROW"]
                  ||keycode==nonTypingKey["RIGHT_ARROW"]
                  ||keycode==nonTypingKey["UP_ARROW"]
                  ||keycode==nonTypingKey["DOWN_ARROW"]
                  ||keycode==nonTypingKey["HOME"]
                  ||keycode==nonTypingKey["END"]
                  ||keycode==nonTypingKey["PAGE_UP"]
                  ||keycode==nonTypingKey["PAGE_DOWN"]);
      },
      keyUpTextareaFunc= function (ev) {
          /*
          record keyCode, timestamp, cursor caret position.
          */
          //ev.trigger();
          var timestamp = (new Date()).getTime() - this.lw_startTime,
              keycode = getChar(ev),
              index = this.lw_liveWritingJsonData.length;


          if (keycode==nonTypingKey["BACKSPACE"]|| keycode==nonTypingKey["DELETE"]){

              var prevKeyDown = index-1;
              if (this.lw_liveWritingJsonData[prevKeyDown]["p"] == "keydown" && this.lw_liveWritingJsonData[prevKeyDown]["k"] == keycode){
                  this.lw_liveWritingJsonData[prevKeyDown]["s"] = ev.srcElement.selectionStart; // this is needed for double click selection which eat-up extra space.
                  this.lw_liveWritingJsonData[prevKeyDown]["keyup_fixed"] = true
              }
              this.lw_liveWritingJsonData[index-1]["s"] = ev.srcElement.selectionStart; // this is needed for double click selection which eat-up extra space.
          }

          if(DEBUG){
              $("#keyup_debug").html(keycode);
              $("#start_up_debug").html(ev.srcElement.selectionStart);
              $("#end_up_debug").html(ev.srcElement.selectionEnd);

              keyup_debug_color_index++;
              keyup_debug_color_index%=randomcolor.length;
              $("#keyup_debug").css("background-color", randomcolor[keyup_debug_color_index]);
          }
      },
      dblclickTextareaFunc = function(ev){
          var timestamp = (new Date()).getTime() - this.lw_startTime,
          pos = this.lw_getCursorTextAreaPosition(),
          keycode = (ev.keyCode ? ev.keyCode : ev.which),
          index = this.lw_liveWritingJsonData.length;

          if(DEBUG){
              $("#double_click_debug").html(keycode);
              $("#start_double_click_debug").html(pos[0]);
              $("#end_double_click_debug").html(pos[1]);

              double_click_debug_color_index++;
              double_click_debug_color_index%=randomcolor.length;
              $("#double_click_debug").css("background-color", randomcolor[double_click_debug_color_index]);
          }
      },
      keyDownTextareaFunc= function (ev) {
          /*
          record keyCode, timestamp, cursor caret position.
          */
      //    ev.preventDefault();
          var timestamp = (new Date()).getTime() - this.lw_startTime,
              it = this,
              keycode = (ev.keyCode ? ev.keyCode : ev.which),
              index = this.lw_liveWritingJsonData.length,
              siStart = 0,
              siEnd=0;
          it.lw_keyDownState = true;

          if (typeof(ev.srcElement.selectionStart) != "undefined" && typeof(ev.srcElement.selectionEnd) != "undefined" ){
              siStart = ev.srcElement.selectionStart;
              siEnd = ev.srcElement.selectionEnd;
          }
          else{
              pos = this.lw_getCursorTextAreaPosition();
              siStart = pos[0];
              siEnd = pos[1]
          }

          if (ev.metaKey === true || ev.ctrlKey === true) {
              if (keycode === 89) {
                  //fire your custom redo logic
                      this.lw_REDO_TRIGGER = true;
              }
              else if (keycode === 90) {
               //special case (CTRL-SHIFT-Z) does a redo (on a mac for example)
                  if (ev.shiftKey === true) {
                  //fire your custom redo logic
                      this.lw_REDO_TRIGGER = true;
                  }
                  else {
                  //fire your custom undo logic
                      this.lw_UNDO_TRIGGER = true;
                  }
              }
              else if (keycode ===65) { // this is select All command.
                  this.lw_liveWritingJsonData[index] = {"p":"keydown", "t":timestamp, "k":nonTypingKey["UP_ARROW"], "s":0, "e":this.value.length };
              }
              if(DEBUG) console.log ("undo:" + this.lw_UNDO_TRIGGER + ", redo:" + this.lw_REDO_TRIGGER);
              this.lw_mostRecentValue = this.value;
              return;
          }
          it.lw_prevSelectionStart = siStart;
          it.lw_prevSelectionEnd = siEnd;

          if (keycode==nonTypingKey["BACKSPACE"]|| keycode==nonTypingKey["DELETE"]){
              this.lw_liveWritingJsonData[index] = {"p":"keydown", "t":timestamp, "k":keycode, "s":siStart, "e":siEnd };
              if(DEBUG)console.log("key down:" +  JSON.stringify(this.lw_liveWritingJsonData[index]) ) ;
          }
          else if (isCaretMovingKey(keycode)){ // for caret moving key, we want to know the position of the cursor after the event occurs.
              var that=this;
              setTimeout(function(){// this is because cursor position is not yet updated.
                  var pos_temp = that.lw_getCursorTextAreaPosition();
                  that.lw_liveWritingJsonData[index] = {"p":"keydown", "t":timestamp, "k":keycode, "s":pos_temp[0], "e":pos_temp[1] };
                  if(DEBUG)console.log("key down:" +  JSON.stringify(that.lw_liveWritingJsonData[index]) ) ;

              },0);
          }
          else{
              if(DEBUG)console.log("key down: (not logged) - (" +  ev.srcElement.selectionStart + "," + ev.srcElement.selectionEnd + ")") ;
          }
          if(DEBUG)console.log("key down:" + keycode );
          if(DEBUG){
              $("#keydown_debug").html(keycode);
              $("#start_down_debug").html(siStart);
              $("#end_down_debug").html(siEnd);

              keydown_debug_color_index++;
              keydown_debug_color_index%=randomcolor.length;
              $("#keydown_debug").css("background-color", randomcolor[keydown_debug_color_index]);
          }

      },
      keyPressTextareaFunc= function (ev) {
          /*
          record keyCode, timestamp, cursor caret position.
          */

          var timestamp = (new Date()).getTime() - this.lw_startTime,
              pos = this.lw_getCursorTextAreaPosition(),
              charCode = String.fromCharCode(ev.charCode),
              keycode = (ev.keyCode ? ev.keyCode : ev.which),
              index = this.lw_liveWritingJsonData.length;
          if(keycode == 13) charCode = "\n";
           if (ev.metaKey === true || ev.ctrlKey === true)
          // undo/redo/select all are taken care of at keyDownTextareaFunc
              return
          // I am not sure why carrige return would not work for string concatenation.
          // for example "1" + "\r" + "2" gives me "12" instead of "1\r2"
          this.lw_liveWritingJsonData[index] = {"p":"keypress", "t":timestamp, "k":keycode, "c":charCode, "s":pos[0], "e":pos[1] };
          if(DEBUG)console.log("key pressed :" + JSON.stringify(this.lw_liveWritingJsonData[index]) );
          if(DEBUG){
              $("#keypress_debug").html(keycode + "," + charCode);
              $("#start_press_debug").html(pos[0]);
              $("#end_press_debug").html(pos[1]);
              keypress_debug_color_index++;
              keypress_debug_color_index%=randomcolor.length;
              $("#keypress_debug").css("background-color", randomcolor[keypress_debug_color_index]);;            }
      },
      mouseUpTextareaFunc = function (ev) {
          var timestamp = (new Date()).getTime()- this.lw_startTime,
              pos = this.lw_getCursorTextAreaPosition(),
              index = this.lw_liveWritingJsonData.length,
              str = this.value.substr(pos[0], pos[1] - pos[0]);
          this.lw_liveWritingJsonData[index] = {"p":"mouseUp", "t":timestamp, "s":pos[0], "e":pos[1]};
          if(DEBUG)console.log("mouseup: " + JSON.stringify(this.lw_liveWritingJsonData[index]));

          if(DEBUG){
              $("#mouseup_debug").html(str);
              $("#start_mouseup_debug").html(pos[0]);
              $("#end_mouseup_debug").html(pos[1]);
              mouseup_debug_color_index++;
              mouseup_debug_color_index%=randomcolor.length;
              $("#mouseup_debug").css("background-color", randomcolor[mouseup_debug_color_index]);;            }
      },
      scrollTextareaFunc = function(ev){
          var timestamp = (new Date()).getTime()- this.lw_startTime,
              index = this.lw_liveWritingJsonData.length;

          if(DEBUG)console.log("scroll event :" + this.scrollTop + " time:" + timestamp);
          this.lw_liveWritingJsonData[index] = {"p":"scroll", "t":timestamp, "h":this.scrollTop, "s":0, "e":0};
      },
      dropStartTextareaFunc= function(ev){
          var timestamp = (new Date()).getTime()- this.lw_startTime,
              pos = this.lw_getCursorTextAreaPosition(),
              index = this.lw_liveWritingJsonData.length,
              str = this.value.substr(pos[0], pos[1] - pos[0]);
          if(DEBUG)console.log("dragstart event (" + this.lw_dragAndDrop + "):" + str + " (" + pos[0] + ":" + pos[1] + ")"  + " time:" + timestamp);
          this.lw_dragAndDrop = !this.lw_dragAndDrop;
          this.lw_dragStartPos = pos[0];
          this.lw_dragEndPos = pos[1];

      },
      dropEndTextareaFunc =  function(ev){
          var timestamp = (new Date()).getTime()- this.lw_startTime,
              pos = this.lw_getCursorTextAreaPosition(),
              index = this.lw_liveWritingJsonData.length,
              str = this.value.substr(pos[0], pos[1] - pos[0]);
              if(DEBUG)console.log("dragEnd event (" + this.lw_dragAndDrop + "):" + str + " (" + pos[0] + ":" + pos[1] + ")"  + " time:" + timestamp);
              this.lw_dragAndDrop = !this.lw_dragAndDrop;
              this.lw_liveWritingJsonData[index] = {"p":"draganddrop", "t":timestamp, "r":str, "s":pos[0], "e":pos[1], "ds":this.lw_dragStartPos , "de":this.lw_dragEndPos };
      },
      dropTextareaFunc= function(ev){
          ev.preventDefault(); // disable drop from outside the textarea
          alert("LiveWritingAPI: Drag and drop in the textarea is disabled by the livewriting api.")
      },
      cutTextareaFunc= function(ev){
          var timestamp = (new Date()).getTime()- this.lw_startTime,
              pos = this.lw_getCursorTextAreaPosition(),
              index = this.lw_liveWritingJsonData.length,
              str = this.value.substr(pos[0], pos[1] - pos[0]);
          this.lw_liveWritingJsonData[index] = {"p":"cut", "t":timestamp, "r":str, "s":pos[0], "e":pos[1] };
          this.lw_CUT_TRIGGER = true;
          if(DEBUG)this.lw_liveWritingJsonData[index]["v"] = this.value;
          if(DEBUG)console.log("cut event :" + str + " (" + pos[0] + ":" + pos[1] + ")"  + " time:" + timestamp);
      },
      pasteTextareaFunc =  function(ev){
           var timestamp = (new Date()).getTime()- this.lw_startTime,
              pos = this.lw_getCursorTextAreaPosition(),
              index = this.lw_liveWritingJsonData.length,
              str = ev.clipboardData.getData('text/plain');
          this.lw_liveWritingJsonData[index] = {"p":"paste", "t":timestamp, "r":str, "s":pos[0], "e":pos[1] };
          this.lw_PASTE_TRIGGER = true;
          if(DEBUG)this.lw_liveWritingJsonData[index]["v"] = this.value;
          if(DEBUG)console.log("paste event :" + ev.clipboardData.getData('text/plain') + " (" + pos[0] + ":" + pos[1] + ")"  + " time:" + timestamp);
      }
      ,
      userinputTextareaFunc = function(userinput_number,options){
          var it = this; // this should be editor
          var timestamp = (new Date()).getTime()-it.lw_startTime,
              index = it.lw_liveWritingJsonData.length;
          it.lw_liveWritingJsonData[index] = {"p":"i", "t":timestamp, "n": userinput_number, "d":options};
      },
      inputTextareaFunc = function(ev){
          var timestamp = (new Date()).getTime()- this.lw_startTime,
              index = this.lw_liveWritingJsonData.length,
              siStart = 0,
              siEnd = 0;

          if(DEBUG) console.log("inputTextareaFunc : s - " + ev.srcElement.selectionStart + " e - " + ev.srcElement.selectionEnd);

          if (typeof(ev.srcElement.selectionStart) != "undefined" && typeof(ev.srcElement.selectionEnd) != "undefined" ){
              siStart = ev.srcElement.selectionStart;
              siEnd = ev.srcElement.selectionEnd;
          }
          else{
              pos = this.lw_getCursorTextAreaPosition();
              siStart = pos[0];
              siEnd = pos[1]
          }
          var currentValue = this.value;

          // this logic is based on the assumption that the undo/redo event is either addition or deletion.
          // if there is a compositie undo/redo event that contains both deletion and additoin, this will not work.

          if (this.lw_UNDO_TRIGGER || this.lw_REDO_TRIGGER || this.lw_keyDownState == false){
              if (DEBUG&& !this.lw_keyDownState) console.log("lw_keyDownState is false.");
              var startIndex = 0,
                  endIndex = 1;
              if(DEBUG) console.log("loop start");
              while( typeof(currentValue[startIndex]) != "undfined" && currentValue[startIndex] == this.lw_mostRecentValue[startIndex] &&startIndex < currentValue.length&&startIndex < currentValue.length ){
                  startIndex++;
              }
              while(currentValue[currentValue.length - endIndex] == this.lw_mostRecentValue[this.lw_mostRecentValue.length - endIndex]
                  && this.lw_mostRecentValue.length - endIndex>startIndex&& currentValue.length - endIndex>startIndex){
                  endIndex++;
              }
              if(DEBUG) console.log("loop end");
              endIndex--;
              if ( this.lw_mostRecentValue.length - endIndex < startIndex){
                  if(DEBUG) alert ("this cannot be happen, unless it exactly the same.");
              }
              var str = currentValue.substring(startIndex, currentValue.length - endIndex);
              this.lw_liveWritingJsonData[index] = {"p":"input", "t":timestamp, "r":str, "ps":startIndex , "pe":this.lw_mostRecentValue.length - endIndex, "cs": siStart, "ce":siEnd};
              if(DEBUG)this.lw_liveWritingJsonData[index]["v"] = currentValue;
              if(DEBUG)this.lw_liveWritingJsonData[index]["pv"] = this.lw_mostRecentValue;
              if(DEBUG)console.log("input2 :" + JSON.stringify(this.lw_liveWritingJsonData[index]) );

          }
          else if (this.lw_PASTE_TRIGGER){
              // see if the last newline char is removed.
              if ( this.lw_liveWritingJsonData[index-1]["p"] == "paste")
              {
                  if (this.lw_liveWritingJsonData[index-1]["r"].length + this.lw_mostRecentValue.length
                      == currentValue.length+1
                      && this.lw_mostRecentValue[this.lw_mostRecentValue.length-1] == "\n")
                  {
                      this.lw_liveWritingJsonData[index-1]["n"] = true;
                  }
              }
              else{
                  if (DEBUG) alert("LiveWritingAPI: lw_PASTE_TRIGGER is true but the most recent trigger is not paste")
              }
          }
          else if (this.lw_CUT_TRIGGER){
              if ( this.lw_liveWritingJsonData[index-1]["p"] == "cut")
              {
                  // see if the cut function also removed the last newline character in the previous line.
                  if (this.lw_liveWritingJsonData[index-1]["s"] != siStart)
                  {
                      this.lw_liveWritingJsonData[index-1]["s"] = siStart;
                  }
              }
              else{
                  if (DEBUG) alert("LiveWritingAPI: lw_PASTE_TRIGGER is true but the most recent trigger is not paste for some reason. :( ")
              }
          }

          this.lw_UNDO_TRIGGER = false;
          this.lw_REDO_TRIGGER = false;
          this.lw_PASTE_TRIGGER = false;
          this.lw_CUT_TRIGGER = false;
          this.lw_keyDownState = false;

          this.lw_mostRecentValue = currentValue;
      },
      // the following function is for codemirror only.
      changeCodeMirrorFunc = function(cm, changeObject){
          var it = cm.getDoc().getEditor();
          var timestamp = (new Date()).getTime()- it.lw_startTime,
              index = it.lw_liveWritingJsonData.length;
          it.lw_liveWritingJsonData[index] = {"p":"c", "t":timestamp, "d":changeObject};
          it.lw_justAdded = true;
          if(DEBUG)console.log("change event :" +JSON.stringify(it.lw_liveWritingJsonData[index])  + " time:" + timestamp);
      },
      changeAceFunc = function(event, editor){
          var it = editor;
          var timestamp = (new Date()).getTime()- it.lw_startTime,
              index = it.lw_liveWritingJsonData.length;
          //if (event.action == "remove") delete event.lines; // we need this to create an inverse operation.
          it.lw_liveWritingJsonData[index] = {"p":"c", "t":timestamp, "d":event};
          if(DEBUG)console.log("change event :" +JSON.stringify(it.lw_liveWritingJsonData[index])  + " time:" + timestamp);
      },
      viewPortchangeCodeMirrorFunc= function(cm,from,to){// this is only for codemirror /
          var it = cm.getDoc().getEditor();
          var timestamp = (new Date()).getTime()- it.lw_startTime,
              index = it.lw_liveWritingJsonData.length;
          var scrollinfo = cm.getScrollInfo();
          it.lw_liveWritingJsonData[index] = {"p":"s", "t":timestamp, "f":scrollinfo.left, "to":scrollinfo.top};
          if(DEBUG)console.log("viewPortChange event :" +JSON.stringify(it.lw_liveWritingJsonData[index])  + " time:" + timestamp);
      }
      ,scrollLeftAceFunc = function(editor, number){
          var it = editor;
          var timestamp = (new Date()).getTime()- it.lw_startTime,
              index = it.lw_liveWritingJsonData.length;
          it.lw_liveWritingJsonData[index] = {"p":"s", "t":timestamp, "n":number, "y":"left"};
          if(DEBUG)console.log("viewPortChange event :" +JSON.stringify(it.lw_liveWritingJsonData[index])  + " time:" + timestamp);
      }
      ,scrollTopAceFunc = function(editor, number){
          var it = editor;
          var timestamp = (new Date()).getTime()- it.lw_startTime,
              index = it.lw_liveWritingJsonData.length;
          it.lw_liveWritingJsonData[index] = {"p":"s", "t":timestamp, "n":number, "y":"top"};
          if(DEBUG)console.log("viewPortChange event :" +JSON.stringify(it.lw_liveWritingJsonData[index])  + " time:" + timestamp);
      },
      cursorAceFunc = function(event, editor){
        var it = editor;
        var timestamp = (new Date()).getTime()- it.lw_startTime,
            index = it.lw_liveWritingJsonData.length;
        it.lw_liveWritingJsonData[index] = {"p":"u", "t":timestamp, "d":editor.session.selection.getRange(), "b": editor.session.selection.isBackwards() + 0};
        if(DEBUG)console.log("change event :" +JSON.stringify(it.lw_liveWritingJsonData[index])  + " time:" + timestamp);
      },
      // the following function is for codemirror only.
      cursorCodeMirrorFunc = function(cm){

          var it = cm.getDoc().getEditor();
          if ( it.lw_justAdded ) {
              it.lw_justAdded = false; // no need to store this since change record will guide us where to put cursor.
              return;
          }
          var fromPos = cm.getDoc().getCursor("from"),
              toPos = cm.getDoc().getCursor("to");
          var timestamp = (new Date()).getTime()- it.lw_startTime ,
              index = it.lw_liveWritingJsonData.length;
          it.lw_liveWritingJsonData[index] = {"p":"u", "t":timestamp, "s":fromPos, "e":toPos};

          if(DEBUG)console.log("cursor event :" +JSON.stringify(it.lw_liveWritingJsonData[index])  + " time:" + timestamp);
      },
      scheduleNextEventFunc = function(){
        // scheduling part
        var it = this;
        if(it.lw_pause)
          return;
        if( it.lw_data_index< 0)
        {
          it.lw_data_index = 0;
        }// this can happen due to the slider
        if ( it.lw_data_index == it.lw_data.length){
          return;
        }
        var startTime = it.lw_startTime;
        var currentTime = (new Date()).getTime();
        var nextEventInterval = startTime + it.lw_data[it.lw_data_index]["t"]/it.lw_playback -  currentTime;
        if(DEBUG)console.log("nextEventInterval : " + nextEventInterval);


        //if(DEBUG)console.log("start:" + startTime + " time: "+ currentTime+ " interval:" + nextEventInterval + " currentData:",JSON.stringify(it.lw_data[0]));
        // let's catch up some of the old changes.
        while(it.lw_data[it.lw_data_index] != undefined
          && nextEventInterval<0 && it.lw_data_index < it.lw_data.length-1){
          it.lw_triggerPlay(false, true);
          nextEventInterval = startTime + it.lw_data[it.lw_data_index]["t"]/it.lw_playback -  currentTime;
        }

        if(it.lw_skip_inactive && nextEventInterval * it.lw_playback > INACTIVE_SKIP_THRESHOLD){
          if(DEBUG)console.log("skipping inactive part : " + nextEventInterval);
          nextEventInterval = SKIP_RESUME_WARMUP_TIME / it.lw_playback;
          it.lw_startTime = currentTime - it.lw_data[it.lw_data_index]["t"]/it.lw_playback  + nextEventInterval;
        }

        if (INSTANTPLAYBACK) nextEventInterval = 0;
         // recurring trigger
        it.lw_next_event = setTimeout(function(){
          it.lw_triggerPlay(false);
        }, nextEventInterval);
      },
      jumptoLineCodeMirror = function(editor, i){
        var t = editor.charCoords({line: i, ch: 0}, "local").top;
        var currentTop = editor.getScrollInfo().top;
        var middleHeight = editor.getScrollerElement().offsetHeight;
        if( t > currentTop && t< currentTop + middleHeight){
          return;
        }
        middleHeight /=2;
        editor.scrollTo(null, t - middleHeight - 5);
      },
      triggerPlayCodeMirrorFunc = function(reverse, skipSchedule){
          var it = this;
          var event = it.lw_data[it.lw_data_index];
          if(reverse){
            it.lw_data_index--;

          }else {
            it.lw_data_index++;
          }

          if (skipSchedule && event['p'] != "c"){
            return;
          }
          it.getDoc().getEditor().focus();
          if(DEBUG) console.log("reverse:" + reverse + " " + JSON.stringify(event));
          if (DEBUG) console.log("Event: "+  event);
            
          if (snapshotReplay)
               it.getDoc().setValue(event.snapshot.join(''));

          if (event['p'] == "c"){ // change in content
                if (snapshotReplay){
                      //change cursor
                       var eventCharAdded = Object.assign({}, event.d.to);
                       eventCharAdded.ch++;
                       it.getDoc().setCursor(eventCharAdded);
                }
                else{
                    var inputData    = event['d'];
                    var startLine = inputData['from']['line'],
                        startCh = inputData['from']['ch'],
                        endLine = inputData['from']['line'],
                        endCh = inputData['from']['ch'],
                        inputType = inputData['origin'],
                        text = inputData['text'];

                    if(reverse){
                      var removed = inputData['removed'];
                      var toRemove = {"line": text.length-1 + startLine, "ch": (text.length ==1 ? startCh + text[0].length : text[removed.length-1].length)}
                      it.getDoc().setSelection(inputData['from'], toRemove, {scroll:true});
                      removed = removed.join('\n');
                      it.getDoc().replaceSelection(removed);
                    }
                    else{
                      var joined_text = text.join('\n');
                      jumptoLineCodeMirror(it,inputData.from.line);
                      it.getDoc().setSelection(inputData['from'], inputData['to']);
                      it.getDoc().replaceSelection(joined_text);
                      var to = {line:inputData.from.line, ch:inputData.from.ch};
                      if (text.length == 1) // same line
                      {
                        to.ch += joined_text.length;
                      }else{ // text.length>1
                        to.line += text.length - 1;
                        to.ch = text[text.length-1].length;
                      }
                      var obj = it.getDoc().markText(inputData['from'], to, {className:"cm-change-markers"});
                      setTimeout(function(){
                        obj.clear();
                      },CM_MARKER_CLEAR_TIME / it.lw_playback );

                    }
                }

         
          

          }
          else if (event['p'] == "u"){ // cursor change
              jumptoLineCodeMirror(it, event.s.line);
              it.getDoc().setSelection(event['s'], event['e']);
          }
          else if (event['p'] == "i"){ //  user input
              var number = (event['n'] ? event['n'] : 0)
              // TODO : run error handling (in case it is not registered. )
              it.userInputRespond[number](event['d']);
          }
          else if (event['p'] == "s"){ // scroll
              it.scrollTo(event["f"], event["to"]);
          }

          // chcek the final text once it is done.

          if (it.lw_data_index == it.lw_data.length){
              if(DEBUG)console.log("done replay");
              // let's stay in the final index
            //  it.lw_data_index = it.lw_data.length -1;
              if ( it.lw_finaltext != it.getValue())
              {
                  console.log("There is discrepancy. Do something");
                  if(DEBUG) alert("LiveWritingAPI: There is discrepancy. Do something" + it.finaltext +":"+ it.getValue());
              }
          }

          // scheduling part
          if (!skipSchedule)
            it.lw_scheduleNextEvent();

      },
      triggerPlayAceFunc =  function(reverse, skipSchedule){
        var it = this;
        var event = it.lw_data[it.lw_data_index];
        if(event == undefined){
          if(DEBUG) alert("no event for index: " + it.lw_data_index);
        }

        if(reverse){
          it.lw_data_index--;

        }else {
          it.lw_data_index++;
        }

        if (skipSchedule && event['p'] != "c"){
          return;
        }


        it.focus();
        if(DEBUG) console.log("reverse:" + reverse + " " + JSON.stringify(event));
        if (event['p'] == "c"){ // change in content
            var inputData    = event['d'];
            var startLine = inputData['start']['row'],
                startCh = inputData['start']['column'],
                endLine = inputData['end']['row'],
                endCh = inputData['end']['column'];

            if (inputData.action == "insert"){ // change in content
              if(reverse){
                it.session.doc.remove(inputData);
              }
              else{
                var textLines = inputData['lines'].join('\n');
                it.moveCursorTo(startLine,startCh);
                it.insert(textLines);
              }
            }else if (inputData.action == "remove"){ // change in content
              //var range = new it.lw_ace_Range(startLine, startCh,endLine, endCh );
              if(reverse){
                var textLines = inputData['lines'].join('\n');
                it.moveCursorTo(startLine,startCh);
                it.insert(textLines);
              }
              else{
                it.session.doc.remove(inputData);
              }
            }
            else{
              if(DEBUG)alert("ace editor has another type of action other than \"remove\" and \"insert\": " + inputData.action);
            }

        }
        else if (event['p'] == "u"){ // cursor change
            it.session.selection.setSelectionRange(event['d'], Boolean(event['b']));
        }
        else if (event['p'] == "i"){ //  user input
            var number = (event['n'] ? event['n'] : 0)
            // TODO : run error handling (in case it is not registered. )
            it.userInputRespond[number](event['d']);
        }
        else if (event['p'] == "s"){ // scroll
            if (event["y"] == "left"){
              it.session.setScrollLeft(event["n"]);
            }else if (event["y"] == "top")
            {
              it.session.setScrollTop(event["n"]);
            }
            else{
              if(DEBUG) alert("unknown scorll type for ace editor: " +event["y"] )
            }
        }

        // chcek the final text once it is done.
        if (it.lw_data_index == it.lw_data.length){
            if(DEBUG)console.log("done replay");
        //    it.lw_data_index = it.lw_data.length -1;

            if ( it.lw_finaltext != it.getValue())
            {
                console.log("There is discrepancy. Do something");
                if(DEBUG) alert("LiveWritingAPI: There is discrepancy. Do something" + it.lw_finaltext +":"+ it.getValue());
            }

            $('.play').trigger("click");

        }

        // scheduling part
        if (!skipSchedule)
          it.lw_scheduleNextEvent();

      }
      ,triggerPlayTextareaFunc =  function(){
          var it = this;
          var event = it.lw_data[it.lw_data_index];
          // TODO textarea does not support reverse / slider yet
          // do somethign here!
          var selectionStart =event['s'];
          var selectionEnd = event['e'];
          if (DEBUG && selectionStart > selectionEnd)
              alert("LiveWritingAPI: selectionStart > selectionEnd("+ selectionStart + "," + selectionEnd + ")");

          it.focus();
          // if selection is there.
          if (selectionStart != selectionEnd){ //
              // do selection
                  // Chrome / Firefox
                  if(typeof(it.selectionStart) != "undefined") {
                      it.selectionStart = selectionStart;
                      it.selectionEnd = selectionEnd;
                  }
                  // IE
                  if (document.selection && document.selection.createRange) {
                      it.select();
                      var range = document.selection.createRange();
                      it.collapse(true);
                      it.moveEnd("character", selectionEnd);
                      it.moveStart("character", selectionStart);
                      it.select();
                  }

          }


          // deal with selection
         if (event['p'] == "keypress"){

              var keycode = event['k'];
              var charvalue = event['c'];
              if (it.version <= 1){
                  charvalue = String.fromCharCode(keycode);
              }

             if (charvalue != "undefined"){ // this is actual letter input
               //   console.log("keycode:" + keycode + " charvalue:" + charvalue);
                  //IE support
                  if(keycode == 13) charvalue = "\n"; // only happens for the stuff befroe version 2

                  if (document.selection) {
                      it.focus();
                      sel = document.selection.createRange();
                      sel.text = charvalue;
                  }else{
                      it.value = it.value.substring(0, selectionStart)
                          + charvalue
                          + it.value.substring(selectionEnd, it.value.length);
                  }
                  setCursorPosition(it, selectionEnd+1, selectionEnd+1);
              }
              if ( it.version <= 1) {
                 if (keycode ==nonTypingKey["BACKSPACE"]  ){// backspace
                      if (it.version == 0){
                          it.value = it.value.substring(0, selectionStart)
                                      + it.value.substring(selectionEnd+1, it.value.length);
                          setCursorPosition(it, selectionStart, selectionStart)
                      }
                      else{
                          if ( selectionStart == selectionEnd){
                              selectionStart--;
                          }
                          it.value = it.value.substring(0, selectionStart)
                                  + it.value.substring(selectionEnd, it.value.length);
                          setCursorPosition(it, selectionStart, selectionStart)
                      };
                  }
                  else if (keycode==nonTypingKey["DELETE"]){
                      if ( selectionStart == selectionEnd){
                          selectionEnd++;
                      }
                      it.value = it.value.substring(0, selectionStart)
                          + it.value.substring(selectionEnd, it.value.length);
                      setCursorPosition(it, selectionStart, selectionStart)
                  }
                  else if (isCaretMovingKey(keycode)){
                      // do nothing.
                      setCursorPosition(it, selectionStart, selectionEnd);
                  }

              }
              // put cursor at the place where you just added a letter.

          }
          else if ( event['p'] == "keydown"){
              var keycode = event['k'];
              if (keycode ==nonTypingKey["BACKSPACE"]){// backspace

                  if ( selectionStart == selectionEnd){
                      selectionStart--;
                  }

                  it.value = it.value.substring(0, selectionStart)
                          + it.value.substring(selectionEnd, it.value.length);
                  setCursorPosition(it, selectionStart, selectionStart)

              }
              else if (keycode==nonTypingKey["DELETE"]){
                  if ( selectionStart == selectionEnd){
                      selectionEnd++;
                  }

                  it.value = it.value.substring(0, selectionStart)
                      + it.value.substring(selectionEnd, it.value.length);
                  setCursorPosition(it, selectionStart, selectionStart)
              }
              else if (isCaretMovingKey(keycode)){
                  // do nothing.
                  setCursorPosition(it, selectionStart, selectionEnd);
              }

          }
          else if (event['p'] == "input"){
              //{"p":"input", "t":timestamp, "r":str, "s":startIndex , "e":this.lw_mostRecentValue.length - endIndex, "cs": siStart, "ce":siEnd, "v":currentValue};
              selectionStart = event['ps'];
              selectionEnd = event['pe'];
              var prevV = it.value;
              var str = event['r'];
              it.value = it.value.substring(0, selectionStart)
                      + str + it.value.substring(selectionEnd);
              setCursorPosition(it, event['cs'], event['ce']);

              if (DEBUG && it.value.localeCompare(event['v']) !=0 )
                  console.log("DIFFERENT REPLAY");

          }
          else if (event['p']=="snapshot"){
              it.value = event['v'];
          }
          else if (event['p'] == "cut"){
              var prevV = it.value
              it.value = it.value.substring(0, selectionStart)
                              + it.value.substring(selectionEnd, it.value.length);
              setCursorPosition(it, selectionStart, selectionStart)
              if (DEBUG && prevV.localeCompare(event['v']) !=0 )
                  console.log("DIFFERENT REPLAY");
          }else if (event['p'] == "paste"){
              var prevV = it.value
              it.value = it.value.substring(0, selectionStart)
                              +event['r']+ it.value.substring(selectionEnd, it.value.length);
              setCursorPosition(it, selectionEnd + event['r'].length, selectionEnd + event['r'].length);
              if (event["n"]){
                  if (DEBUG&& it.value[it.value.length-1] != "\n"){
                      alert("LiveWritingAPI: new line char cannot be removed in paste event. ");
                  }
                  it.value = it.value.substring(0,it.value.length-1);
              }
              if (DEBUG && prevV.localeCompare(event['v']) !=0 )
                  console.log("DIFFERENT REPLAY");
          }
          else if (event['p'] == "draganddrop"){
              it.value = it.value.substring(0, event['ds'])
                              + it.value.substring(event['de'], it.value.length);

              it.value = it.value.substring(0, selectionStart)
                              +event['r']+ it.value.substring(selectionStart, it.value.length);
              setCursorPosition(it, selectionStart, selectionEnd);
          }
          else if (event['p'] == "scroll"){
              it.scrollTop = event['h']
          }
          else if (event['p'] == "userinput" || event['p'] == "i"){
              it.userInputRespond[event['n']](event['d']);
          }
          else if (event['p'] == "mouseUp")
          {
              setCursorPosition(it, selectionStart, selectionEnd);
          }

          it.lw_data_index++;
          // chcek the final text once it is done.
          if (it.lw_data_index == it.lw_data.length){
              if(DEBUG)console.log("done replay");
        //      it.lw_data_index = it.lw_data.length -1;

              if (it.lw_finaltext != it.value){
                  console.log("There is discrepancy. Do something");
                  if(DEBUG) alert("LiveWritingAPI: There is discrepancy. Do something" + it.lw_finaltext +":"+ it.value);
              }

              $('.play').trigger("click");
          }
          // scheduling part
          it.lw_scheduleNextEvent();
      },
      updateSlider = function(it){
        if(it.lw_pause) return;
        var currentTime = (new Date()).getTime();
        var value = (currentTime -  it.lw_startTime) * it.lw_playback;
        if (value > it.lw_endTime ) value = it.lw_endTime;
        it.lw_sliderValue = value;
        $(".livewriting_slider").slider("value",value);

        $(".lw-current-time").text(convertTimeToString(value));
        if ( value > it.lw_endTime){
          livewritingPause(it);
          it.lw_preJogState = false;
          return;
        }
        setTimeout(function(){
            updateSlider(it);
        },SLIDER_UPDATE_INTERVAL);

      },
      livewritingResume = function(it){
        var options = {
          label: "pause",
          icons: {
            primary: "ui-icon-pause"
          }
        };

        var logObj = {event: "play/pause"};
        interactionTrace(logObj);


        $( ".lw_toolbar_play" ).button( "option", options );
        it.lw_pause = false;
        var time  = $(".livewriting_slider").slider("value");
        var currentTime = (new Date()).getTime();
        it.lw_startTime = currentTime - time / it.lw_playback;
        //it.lw_resumedTime = (new Date()).getTime();
        //it.lw_startTime = it.lw_startTime + (it.lw_resumedTime - it.lw_pausedTime);
        it.lw_scheduleNextEvent();
        updateSlider(it);
      },
      sliderGoToEnd = function(it){
        interactionTrace({event: "sliderEnd"});
        var max = $( ".livewriting_slider" ).slider( "option", "max" );
        if(it.lw_type == "ace"){
          it.setValue(it.lw_finaltext);
          it.moveCursorTo(0,0);
        }
        else if(it.lw_type == "codemirror"){
          it.getDoc().setValue(it.lw_finaltext);
          it.getDoc().setSelection({"line":0, "ch":0},{"line":0, "ch":0}, {scroll:true});
        }
        it.lw_data_index = it.lw_data.length-1;
        livewritingPause(it);
        $(".livewriting_slider").slider("value", max);
        $(".lw-current-time").text(convertTimeToString(max));
      //  updateSlider(it);
      },
      sliderGoToBeginning = function(it){
         interactionTrace({event: "sliderBeginning"});

        if(it.lw_type == "ace"){
          it.setValue(it.lw_initialText)
        }
        else if(it.lw_type == "codemirror"){
          it.getDoc().setValue(it.lw_initialText);
        }

        it.lw_data_index = 0;
        livewritingPause(it);
        $(".livewriting_slider").slider("value", 0);
        $(".lw-current-time").text(convertTimeToString(0));
        //updateSlider(it);
      },
      livewritingPause = function(it){
        interactionTrace({'event': "play/pause"});
            
        it.lw_pause = true;
        clearTimeout(it.lw_next_event);
        var options = {
          label: "play",
          icons: {
            primary: "ui-icon-play"
          }
        };
        $(".lw_toolbar_play" ).button( "option", options );
      },
      convertTimeToString  = function(time){
        var totalSec = time/ 1000;
        var hours = parseInt( totalSec / 3600 ) % 24 ;
        var minutes = parseInt( totalSec / 60 ) % 60;
        var seconds = parseInt(totalSec % 60);

        return (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds  < 10 ? "0" + seconds : seconds);

      }
      ,
      configureToolbar= function(it, navbar){

        var time = convertTimeToString(it.lw_endTime);
//        navbar.draggable(); // this line requires jquery ui
        navbar.append("<div class='livewriting_slider_wrapper'><div class = 'livewriting_slider'></div></div>");
        navbar.append('<div class="livewriting_toolbar_wrapper"><div class="livewriting_navbar_buttons_left"><button class = "lw_toolbar_button lw_toolbar_play">pause</button><button id="lw_toolbar_beginning" class = "lw_toolbar_button">go to beginning</button><button id="lw_toolbar_end" class = "lw_toolbar_button">go to end</button></div><div class="livewriting_navbar_buttons_right"><div><span class="lw-current-time navbar_text"></span> / '+time+'&nbsp;<button id="lw_toolbar_share" class="lw_toolbar_button">Embed</button><button id="lw_toolbar_stat" class = "lw_toolbar_button">Show Histogram</button><button id="lw_jogshuttle_toggle" class = "lw_toolbar_button">Toggle Jog Shuttle</button><button id="lw_toolbar_skip" class = "lw_toolbar_button">skip inactive parts</button><!--<button id="lw_toolbar_setting" class = "lw_toolbar_button">settings</button>--><button class = "lw_toolbar_button livewriting_speed navbar_text lw_toolbar_speed" >'+it.lw_playback+'&nbsp;X</button><div id="lw_playback_slider"></div>' +
          // '<button class = "lw_toolbar_button " id="lw-hide-navbar">Hide</button>' +
          '</div></div></div>');

        $(".livewriting_slider").append("<canvas id='livewriting_histogram' width="+canvas_histogram_width+" height="+canvas_histogram_height+"></canvas>");
        $("#lw-nav-bar-toggle").hide();
        $("#lw-toggle-time").hide();
        $("#lw-toggle-play").hide();
        $("#slider").css("display","none");

        $("#lw-hide-navbar").button({text: false,
          icons: {
            primary: "ui-icon-triangle-1-s"
          }
        }).click(function(){
          toggleNavBar();
        });
        $("#lw_jogshuttle_toggle").button({
          text: false,
          icons: {
            primary: "ui-icon-radio-on"
          }
        }).click(function(){
              interactionTrace({'event': 'toggleNipple'});
          $("#lw-jog-shuttle").toggle();
          $("#lw_jogshuttle_toggle .ui-button-text").toggleClass("ui-button-text-toggle");
        });

        $("#lw_jogshuttle_toggle .ui-button-text").addClass("ui-button-text-toggle");

        $( ".livewriting_speed" ).button();
        $( ".lw_toolbar_speed" ).button().click(function(){
          $("#lw_playback_slider").toggle();
        });

        $( "#lw_toolbar_setting" ).button({
          text: false,
          icons: {
            primary: "ui-icon-gear"
          }
        }).click(function(){
          console.log("for now, nothing happens")
        });

        var speedSliderUpdate = function(event, ui){


          var value  = $("#lw_playback_slider").slider("value")/10.0;

          //Interaction trace
          interactionTrace({'event': 'speed slider', sliderValue: value});

          it.lw_playback = Math.pow(2.0, value) ;

          var time  = $(".livewriting_slider").slider("value");
          var currentTime = (new Date()).getTime();
          it.lw_startTime = currentTime - time/it.lw_playback;

          $(".livewriting_speed>span").text(it.lw_playback.toFixed(1) + " X");
        };
        $("#lw_playback_slider").slider({
          orientation : "vertical",
          range: "min",
          min: -20,
          max: 60,
          value: 0,
          slide: speedSliderUpdate,
          stop: function(event, ui) {
            speedSliderUpdate(event,ui);
            $("#lw_playback_slider").hide();
          }
        });

        $(".livewriting_toolbar_wrapper").toggleClass(".ui-widget-header");
        $( "#lw_toolbar_beginning" ).button({
          text: false,
          icons: {
            primary: "ui-icon-seek-start"
          }
        }).click(function(){
          sliderGoToBeginning(it);
        });
        $( "#lw_toolbar_slower" ).button({
          text: false,
          icons: {
            primary: "ui-icon-minusthick"
          }
        }).click(function(){

          it.lw_playback = it.lw_playback / 2.0;
          if (it.lw_playback <0.25){
            it.lw_playback *= 2.0;
          }

          var time  = $(".livewriting_slider").slider("value");
          var currentTime = (new Date()).getTime();
          it.lw_startTime = currentTime - time/it.lw_playback;

          $(".livewriting_speed").text(it.lw_playback);
        });
        $( ".lw_toolbar_play" ).button({
          text: false,
          icons: {
            primary: "ui-icon-pause"
          }
        })
        .click(function() {
          var options;
          if ( $( this ).text() === "pause" ) {
            livewritingPause(it);
          } else {
            livewritingResume(it);
          }
          $( this ).button( "option", options );
        });
        $( "#lw_toolbar_faster" ).button({
          text: false,
          icons: {
            primary: "ui-icon-plusthick"
          }
        }).click(function(){
          it.lw_playback = it.lw_playback * 2.0;
          if (it.lw_playback > 64.0){
            it.lw_playback /= 2.0;
          }
          var time  = $(".livewriting_slider").slider("value");
          var currentTime = (new Date()).getTime();
          it.lw_startTime = currentTime - time/it.lw_playback;

          $(".livewriting_speed").text(it.lw_playback);
        });
        $( "#lw_toolbar_end" ).button({
          text: false,
          icons: {
            primary: "ui-icon-seek-end"
          }
        }).click(function(){
          sliderGoToEnd(it);
        });

        $("#lw_toolbar_stat").button({
          text:false,
          icons:{
            primary:"ui-icon-image"
          }
        }).click(function(e){
              interactionTrace({'event': 'stats'});
          $("#lw_toolbar_stat .ui-button-text").toggleClass("ui-button-text-toggle");
          $("#livewriting_histogram").toggle();
          $("div.livewriting_slider_wrapper").toggleClass("histogram_slider_wrapper");
        });

        var frame_width=640;
        var frame_height=360;
        var frame
        var link = window.location.href

        $('#embed_size').change(function(event) {
            var fullSize = event.target.value
            frame_width = fullSize.split('*')[0]
            frame_height = fullSize.split('*')[1]
            frame = `<iframe width="${frame_width}" height="${frame_height}"  src="${link}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
            $("#post-embed").text(frame);
        })

        frame = `<iframe width="${frame_width}" height="${frame_height}"  src="${link}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`

        $("#lw_toolbar_share").button({
          text:false,
          icons:{
            primary:"ui-icon-link"
          }
        }).click(function(e){
              interactionTrace({'event': 'share'});
          $('#embed_modal').bPopup({
            modalClose: false,
            opacity: 0.7,
            positionStyle: 'absolute',
            escClose :false
          });
          $("#post-embed").text(frame);
          if (document.querySelector("#editor")) {
            html2canvas(document.querySelector("#editor")).then(canvas => {
              document.querySelector("#backImage").appendChild(canvas)
            });
          }
          if (document.querySelector(".CodeMirror")) {
            html2canvas(document.querySelector(".CodeMirror")).then(canvas => {
              document.querySelector("#backImage").appendChild(canvas)
            });
          }
          });

        $("#close_embed").button().css({ width: '150px', margin:'5px'}).click(function(){
          $('#embed_modal').bPopup().close();
          document.querySelector("#backImage").innerHTML = ""
        });

        $("#lw_toolbar_skip").button({
          text:false,
          icons:{
            primary:"ui-icon-arrowreturnthick-1-n"
          }
        }).click(function(e){
              interactionTrace({'event': 'skipInactiveToggle'});
          it.lw_skip_inactive = !it.lw_skip_inactive;
          $("#lw_toolbar_skip .ui-button-text").toggleClass("ui-button-text-toggle");
          if(it.lw_skip_inactive){
            clearTimeout(it.lw_next_event);
            it.lw_scheduleNextEvent();
            $(".ui-slider-inactive-region").css("background-color", "#ccc");
            $("div.livewriting_slider").css("background","#F49C25");
          }
          else{
            $(".ui-slider-inactive-region").css("background-color", "#fff");
            $("div.livewriting_slider").css("background","#E4E3E3");
          }
        });
      },
      sliderEventHandler = function(it,value){

        interactionTrace({'event': 'sliderEvent', 'value': value});

        var time  = value ;
        var currentTime = (new Date()).getTime();
        it.lw_startTime = currentTime - time/it.lw_playback;
        if (!it.lw_pause)
          clearTimeout(it.lw_next_event);
        if ( it.lw_sliderValue > time) // backward case
        {
          while(it.lw_data_index>0  && time < it.lw_data[it.lw_data_index-1].t){
            it.lw_data_index--;
            if (!snapshotReplay){
                  it.lw_triggerPlay(true, true);
                  it.lw_data_index++;
            }     
            it.lw_data_index = Math.max(it.lw_data_index,0);
            if(DEBUG)console.log("slider backward:" + it.lw_data_index);
            if(DEBUG)console.log("value:" + it.getValue() + "length:" + it.getValue().length);
          }
          if (snapshotReplay)
          {
                it.lw_triggerPlay(true, true);
                it.lw_data_index++; 
          }
        } else { // forward case
          while(it.lw_data_index<it.lw_data.length
            && time > it.lw_data[it.lw_data_index].t){
                   if(DEBUG)console.log("slider forward(time:" + time + "):" + it.lw_data_index);
                  if(DEBUG)console.log("data index time: " + it.lw_data[it.lw_data_index].t);
                  if (!snapshotReplay){
                      it.lw_triggerPlay(false, true);
                  }
                  else{
                        it.lw_data_index++;
                  }
              //            && it.lw_sliderValue < it.lw_data[it.lw_data_index].t){

            //if(DEBUG)console.log("value:" + it.getValue());
          }
          if (snapshotReplay){
                if (it.lw_data_index == it.lw_data.length)
                  it.lw_data_index-= 2; 
                it.lw_triggerPlay(false, true);
          }   
        }
        // this handles forward when pause.
        //if(it.lw_pause){
        it.lw_sliderValue = time;

        if (!it.lw_pause){
          it.lw_scheduleNextEvent();
        }
      },
      createJogShuttle = function(it, zone_id){

        var manager = nipplejs.create({
            zone: document.getElementById(zone_id),
            mode: 'static',
            position: {left: '50%', top: '50%'},
            color: 'red',
            size:'80'
        });

        manager.on("start", function(obj, instance, data){
          if(DEBUG)console.log("started");
          it.lw_preJogState = !it.lw_pause;
          if(it.lw_preJogState)
            livewritingPause(it);
          it.lw_jogValue = 0;
          it.lw_jogLoop = setInterval(function(){
            var lw_slider = $(".livewriting_slider");
            var value = lw_slider.slider("value");
            value += it.lw_jogValue * SLIDER_UPDATE_INTERVAL * 20;
            lw_slider.slider('value',value);
            $(".lw-current-time").text(convertTimeToString(value));

            lw_slider.slider('option','slide').call(lw_slider,null,{ handle: $('.ui-slider-handle', lw_slider), value: value });
     },SLIDER_UPDATE_INTERVAL /2);
        });

        manager.on("move", function(obj, data){
          var current_speed = parseFloat($(".livewriting_speed").text());
          it.lw_jogValue = ( data.position.x- data.instance.position.x) / data.instance.options.size / 2;

        });

        manager.on("end", function(obj, instance, data){
          if(DEBUG)console.log("ended");
          clearInterval(it.lw_jogLoop);
          if(it.lw_preJogState)
            livewritingResume(it);
        });

      }
      ,
      toggleNavBar = function(){
        $(".livewriting_navbar_inner").toggle();
        $("#lw-nav-bar-toggle").toggle();
        $("#lw-toggle-time").toggle();
        $("#lw-toggle-play").toggle();
      }
      ,
      createNavBar = function(it){
        if(DEBUG)console.log("create Navigation Bar");
        var end_time = it.lw_data[it.lw_data.length-1]["t"];
        if(DEBUG) console.log("slider end time : " + end_time);
        // ending Time
        if ( it.lw_type == "ace"){
          if($('.ace_editor').length>1){
            if(DEBUG) console.error("For now live writing does not support multiple editors.");
          }
          $('.ace_editor').after("<div class = 'livewriting_navbar'><div class ='livewriting_navbar_expand'><input type=text id='lw-hidden-inputfield' style='opacity:0;'><span id ='lw-toggle-time' class='lw-current-time navbar_text' style='color:gray;'></span>&nbsp;&nbsp;<button id ='lw-toggle-play'class = 'lw_toolbar_button lw_toolbar_play'>pause</button><button id ='lw-nav-bar-toggle' class = 'lw_toolbar_button'>toggle</button></div><div class ='livewriting_navbar_inner'></div></div>");
          $('.ace_editor').after("<div id='lw-jog-shuttle' style='display: none'>");
          var navbar = document.getElementsByClassName('livewriting_navbar')
          var editor_htmlElement = document.getElementById('editor')
          if (navbar['length']>0){
            editor_htmlElement.style.height = '88%'
          }

        }else if ( it.lw_type == "codemirror"){
          if($('.CodeMirror').length>1){
            if(DEBUG) console.error("For now live writing does not support multiple editors.");
          }
          $('.CodeMirror').after("<div class = 'livewriting_navbar'><div class ='livewriting_navbar_expand'><input type=text id='lw-hidden-inputfield' style='opacity:0;'><span id ='lw-toggle-time' class='lw-current-time navbar_text'></span>&nbsp;&nbsp;<button id = 'lw-toggle-play' class = 'lw_toolbar_button lw_toolbar_play'>pause</button><button id ='lw-nav-bar-toggle'  class = 'lw_toolbar_button'>toggle</button></div><div class ='livewriting_navbar_inner'></div></div>");
          $('.CodeMirror').after("<div id='lw-jog-shuttle' style='display: none'>");
          var navbar = document.getElementsByClassName('livewriting_navbar')
          var editor_htmlElement = document.getElementsByClassName('cm-s-default')[0]
          if (navbar['length']>0){
            editor_htmlElement.style.height = '88%'
          }
        } // end of codemirror.
        $("#lw-nav-bar-toggle").button({text: false,
          icons: {
            primary: "ui-icon-triangle-1-n"
          }
        }).click(function(){
          toggleNavBar();
        });
        var navbar = $('.livewriting_navbar_inner');
        createJogShuttle(it, "lw-jog-shuttle");
        configureToolbar(it, navbar);
        $('.livewriting_navbar').draggable({
          stop: function( event, ui ) {
            $('.livewriting_navbar').css("height", "");
          },
          cancel: 'div'
        });
        $('.livewriting_navbar').css("height", "");
        var slider  = $('.livewriting_slider').slider({
          min: 0,
          max : end_time + 1,
          slide: function(event,ui){
            sliderEventHandler(it,ui.value);
          }
        });
        $(".livewriting_slider").slider("value",0);

      },
      createLiveWritingTextArea= function(it, type, options, initialValue){

              var defaults = {
                  name: "Default live writing textarea",
                  startTime: null,
                  stateMouseDown: false,
                  writeMode: null,
                  readMode:null,
                  noDataMsg:"I know you feel in vain but do not have anything to store yet. ",
                  leaveWindowMsg:'You haven\'t finished your post yet. Do you want to leave without finishing?'
              };
              it.lw_settings =  $.extend(defaults, options);
              //Iterate over the current set of matched elements
              it.lw_type = type;
              it.lw_startTime = (new Date()).getTime();

              if(DEBUG)console.log("starting time:" + it.lw_startTime);

              it.lw_liveWritingJsonData = [];
              it.lw_initialText = initialValue;
              it.lw_mostRecentValue = initialValue;
              it.lw_prevSelectionStart = 0;
              it.lw_prevSelectionEnd = 0;
              it.lw_keyDownState = false;
              it.lw_UNDO_TRIGGER = false;
              it.lw_REDO_TRIGGER = false;
              it.lw_PASTE_TRIGGER = false;
              it.lw_CUT_TRIGGER = false;
              it.lw_skip_inactive = false;
              //code to be inserted here
              it.lw_getCursorTextAreaPosition = getCursorTextAreaPosition;
              it.userInputRespond = {};
              var aid = getUrlVar('aid');
              if (aid){ // read mode
                  if (it.lw_type == "codemirror"){
                      if (it.options.placeholder){
                         it.setOption("placeholder","");
                      }
                  }

                  playbackbyAid(it, aid);
                  it.lw_writemode = false;
                  if(it.lw_settings.readMode != null)
                      it.lw_settings.readMode();
                  // TODO handle user input?
                  //preventDefault ?
                  //http://forums.devshed.com/javascript-development-115/stop-key-input-textarea-566329.html
              }
              else
              {
                  it.lw_writemode = true;

                  if ( type == "textarea"){
                    it.value = it.lw_initialText;

                      it.onkeyup = keyUpTextareaFunc;
                      it.onkeypress = keyPressTextareaFunc;
                      it.onkeydown = keyDownTextareaFunc
                      it.onmouseup = mouseUpTextareaFunc;
                      it.onpaste = pasteTextareaFunc;
                      it.oncut = cutTextareaFunc;
                      it.onscroll = scrollTextareaFunc;
                      //it.ondragstart = dropStartTextareaFunc;
                      //it.ondragend = dropEndTextareaFunc;
                      it.ondrop = dropTextareaFunc;
                      it.ondblclick = dblclickTextareaFunc;
                      it.oninput = inputTextareaFunc;
                  }
                  else if (type == "codemirror"){
                    it.setValue(it.lw_initialText);
                    it.on("change", changeCodeMirrorFunc);
                    it.on("cursorActivity", cursorCodeMirrorFunc);
                    it.on("scroll", viewPortchangeCodeMirrorFunc)
                  }
                  else if (type == "ace"){
                    it.setValue(it.lw_initialText)

                    it.on("change", changeAceFunc);
                    //it.on("changeCursor", cursorAceFunc);
                    it.on("changeSelection", cursorAceFunc);
                    it.session.on("changeScrollLeft", function(number){
                      scrollLeftAceFunc(it,number); // this is needed to pass the editor instance. by deafult it has edit session.
                    });
                    it.session.on("changeScrollTop", function(number){
                      scrollTopAceFunc(it,number); /// this is needed to pass the editor instance.by deafult it has edit session.
                    });
                  }



                  it.onUserInput = userinputTextareaFunc;
                  it.lw_writemode = true;
                  it.lw_dragAndDrop = false;
                  if(it.lw_settings.writeMode != null)
                      it.lw_settings.writeMode();
                  $(window).onbeforeunload = function(){
                      return setting.levaeWindowMsg;
                  };

              }

              if(DEBUG==true && it.lw_type=="textarea")
                  $( "body" ).append("<div><table><tr><td>name</td><td>keyDown</td><td>keyPress</td><td>keyUp</td><td>mouseUp</td><td>double click</td></tr><tr><td>keycode</td><td><div id=\"keydown_debug\"></div></td><td><div id=\"keypress_debug\"></div></td><td><div id=\"keyup_debug\"></div></td><td><div id=\"mouseup_debug\"></div></td><td><div id=\"double_click_debug\"></div></td></tr><tr><td>start</td><td><div id=\"start_down_debug\"></div></td><td><div id=\"start_press_debug\"></div></td><td><div id=\"start_up_debug\"></div></td><td><div id=\"start_mouseup_debug\"></div></td><td><div id=\"start_double_click_debug\"></div></td></tr><tr><td>end</td><td><div id=\"end_down_debug\"></div></td><td><div id=\"end_press_debug\"></div></td><td><div id=\"end_up_debug\"></div></td><td><div id=\"end_mouseup_debug\"></div></td><td><div id=\"end_double_click_debug\"></div></td></tr></table></div>");
      },
      getActionData = function(it){
          var data = {};

          data["version"] = 4;
          data["playback"] = 1; // playback speed
          data["editor_type"] = it.lw_type;
          data["initialtext"] = it.lw_initialText;
          data["action"] = it.lw_liveWritingJsonData;
          data["localEndtime"] = new Date().getTime();
          data["localStarttime"] = it.lw_startTime;

          if (it.lw_type == "textarea")
              data["finaltext"] = it.value;
          else if (it.lw_type == "codemirror")
              data["finaltext"] = it.getValue();
          else if (it.lw_type == "ace")
              data["finaltext"] = it.getValue();
          return data;
      }
      ,postData = function(it, url, useroptions, respondFunc){
          if (it.lw_liveWritingJsonData.length==0){
              alert(it.lw_settings.noDataMsg);
              respondFunc(false);
              return;
          }

          // see https://github.com/panavrin/livewriting/blob/master/json_file_format
          var data = getActionData(it);
          data["useroptions"] = useroptions;
          // Send the request
          $.ajax({
            url:url,
            type:"post",
            data:JSON.stringify(data),
            contentType:"text/plain",
            success: function(response, textStatus, jqXHR) {
                // Live Writing server should return article id (aid)
                if (respondFunc){
                    var receivedData=JSON.parse(jqXHR.responseText);
                    if (respondFunc)
                        respondFunc(true, receivedData["aid"]);
                    $(window).onbeforeunload = false;
                }

                $(window).onbeforeunload = false;

            }
          });

      },
      playbackbyAid = function(it, articleid, url){

          url = (url ? url : "play")
          if(DEBUG)console.log(it.lw_settings.name);
          $.post(url, {"aid":articleid}, function(response, textStatus, jqXHR) {
              var json_file=JSON.parse(jqXHR.responseText);
              playbackbyJson(it, json_file);
          }, "json")
          .fail(function( jqXHR, textStatus, errorThrown) {
              alert("LiveWritingAPI: play failed: " + jqXHR.responseText );
          });
      },
      histValue = function(x){
        return 0.3 + 0.7 * Math.pow(2*x - Math.pow(x,2),0.5);
      }
      ,drawHistogram = function(it){
        if(it.lw_type!="ace" && it.lw_type!="codemirror"){
          console.error("histogram only supports ace editor / codemirror for now. ");
          return;
        }
        var c = document.getElementById("livewriting_histogram");
        var ctx = c.getContext("2d");

        var total_length = it.lw_data[it.lw_data.length-1]["t"]+1;
        var inserted = new Array(lw_histogram_bin_number).fill(0);
        var removed = new Array(lw_histogram_bin_number).fill(0);
        var maxChange = -1;
        for (var i=0; i< it.lw_data.length; i++){
          if(it.lw_data[i].p != "c")
            continue;
          var starting_time = it.lw_data[i]['t'];
          var index = Math.round(starting_time / total_length * lw_histogram_bin_number);
          var length = -1;
          if(it.lw_type=="ace"){
            if (it.lw_data[i].d.action == "insert")
            {
              length = it.lw_data[i].d.lines.join().length;
              inserted[index] += length
            }
            else if(it.lw_data[i].d.action == "remove"){
              length = it.lw_data[i].d.lines.join().length;
              removed[index] += length;
            }
          }else if (it.lw_type == "codemirror"){
            if(it.lw_data[i].d.removed){
              length = it.lw_data[i].d.removed.join().length;
              removed[index] += length
            }
            if(it.lw_data[i].d.text){
              length = it.lw_data[i].d.text.join().length;
              inserted[index] += length;
            }
          }
          if(inserted[index] > maxChange)
            maxChange = inserted[index];
          if(removed[index] > maxChange)
            maxChange = removed[index];
        }
        var bin_size = canvas_histogram_width / lw_histogram_bin_number;
        if(DEBUG)console.log("binsize:" + bin_size  + " maxChange:" + maxChange);
        var value = 0;
        for (var i=0; i< lw_histogram_bin_number; i++){
          if(inserted[i]>0){
            value = histValue(inserted[i]/maxChange);
            ctx.fillStyle = "#97DB97";
            ctx.fillRect(bin_size*i,canvas_histogram_height/2 * (1-value),bin_size,canvas_histogram_height/2 * value);
            if(DEBUG)console.log("i:" + i + ", inserted:" + inserted[i] + " value: " + value);
          }
          if(removed[i]>0){
            value = histValue(removed[i]/maxChange);
            ctx.fillStyle = "#EB5555";
            ctx.fillRect(bin_size*i,canvas_histogram_height/2,bin_size,canvas_histogram_height/2* value);
            if(DEBUG)console.log("i:" + i + ", removed:" + removed[i] + " value: " + value);
          }
        }
      }
      ,
      playbackbyJson = function(it,json_file){

        if(it.lw_type == "codemirror")
            it.lw_triggerPlay = triggerPlayCodeMirrorFunc;
        else if (it.lw_type == "textarea")
            it.lw_triggerPlay = triggerPlayTextareaFunc;
        else if (it.lw_type == "ace"){
            it.lw_triggerPlay = triggerPlayAceFunc;
            it.lw_ace_Range = ace.require("ace/range").Range;
            it.setReadOnly(true);
//it.$blockScrolling = Infinity;
        }


         //establish initial snapshot as blank
            //snapshots are stored as arrays of strings
            //with each line at an index 
        
        for (i=0; i < json_file.action.length; i++)
        {            
            var delta = json_file.action[i].d;

            //if there is no delta, just copy snapshot, move along
            if (delta == undefined) { 
               json_file.action[i].snapshot = json_file.action[i-1].snapshot.slice();
               continue;
            }

            //if first frame, find max num lines, make 
            var snapshot;
            if (i == 0) {
                var maxLine = Math.max.apply(null, json_file.action.map(function(action){
                      if (action.d != undefined && action.d.to != undefined) {
                            return action.d.to.line; 
                      }
                      else {
                            return 0;
                      }
                }));

                snapshot = Array(maxLine+1).fill("");               
            }   
            else {
                snapshot = json_file.action[i-1].snapshot.slice(); 
            }
                
            var selectionStart = delta.from;
            var selectionEnd = delta.to;

            if (delta.removed != "") //of removal made
            {
                  //if selection on same line
                  if (selectionStart.line == selectionEnd.line){
                       var lineToEdit = snapshot[selectionStart.line];
                       snapshot[selectionStart.line] = [lineToEdit.slice(0,selectionStart.ch),lineToEdit.slice(selectionEnd.ch)].join('');
                  }
                  else
                  {
                      //First, delete all full lines in selection
                        for (var j = selectionStart.line+1; j <= selectionEnd.line; j++)
                              snapshot[j] = "";  
                      //Delete portion of other lines
                      snapshot[selectionStart.line] = snapshot[selectionStart.line].slice(0,selectionStart.ch);
                      snapshot[selectionEnd.line] = snapshot[selectionEnd.line].slice(selectionEnd.ch);
           
                  }
   
            }
            else if (delta.text != "")   //if addition made
            {    
                  if (delta.text.length == 2){
                         snapshot[selectionStart.line] += "\n"; 
                  }   
                  else{
                        var line = snapshot[selectionStart.line];
                        var newLine = [line.slice(0,selectionStart.ch),delta.text[0],line.slice(selectionStart.ch)].join('');
                        snapshot[selectionStart.line] = newLine;   
                  }
                                  
            }
            json_file.action[i].snapshot = snapshot;
        }



// de-register event handler.
        if ( it.lw_type  == "textarea"){
            it.onkeyup = null;
            it.onkeypress = null;
            it.onkeydown = null
            it.onmouseup = null;
            it.onpaste = null;
            it.oncut = null;
            it.onscroll = null;
            //it.ondragstart = dropStartTextareaFunc;
            //it.ondragend = dropEndTextareaFunc;
            it.ondrop = null;
            it.ondblclick = null;
            it.oninput = null;
        }
        else if (it.lw_type  == "codemirror"){
            it.off("change", changeCodeMirrorFunc);
            it.off("cursorActivity", cursorCodeMirrorFunc);
            it.off("scroll", viewPortchangeCodeMirrorFunc)
        }
        else if (it.lw_type  == "ace"){
          it.off("change", changeAceFunc);
          //it.on("changeCursor", cursorAceFunc);
          it.off("changeSelection", cursorAceFunc);
          it.session.off("changeScrollLeft", function(number){
            scrollLeftAceFunc(it,number); // this is needed to pass the editor instance. by deafult it has edit session.
          });
          it.session.off("changeScrollTop", function(number){
            scrollTopAceFunc(it,number); /// this is needed to pass the editor instance.by deafult it has edit session.
          });
        }
        it.lw_scheduleNextEvent = scheduleNextEventFunc;

        it.focus();

        if(DEBUG)console.log(it.lw_settings.name);
        it.lw_version = json_file["version"];
        it.lw_playback = (json_file["playback"]?json_file["playback"]:1);
        it.lw_type = (json_file["editor_type"]?json_file["editor_type"]:"textarea"); // for data before the version 3 it has been only used for textarea
        it.lw_finaltext = (json_file["finaltext"]?json_file["finaltext"]:"");
        it.lw_initialText = (json_file["initialtext"]?json_file["initialtext"]:"");
        if(it.lw_type == "codemirror"){
          it.setValue(it.lw_initialText);
        }
        else if (it.lw_type == "textarea"){
          it.value = it.lw_initialText;
        }
        else if (it.lw_type == "ace"){
          it.setValue(it.lw_initialText)
        }

        it.lw_data_index = 0;
        it.lw_data=json_file["action"];
        it.lw_endTime = it.lw_data[it.lw_data.length-1].t;
        //it.lw_endTime = it.lw_data[it.lw_data.length-1].t;
        //it.lw_endTime = json_file.localEndtime - json_file.localStarttime;
    //    if (it.lw_version<=3)data = (data?data:json_file["data"]); // this is for data before version 3
        if(DEBUG)console.log(it.name + "play response recieved in version("+it.version+")\n" );



        var currTime = (new Date()).getTime();
        it.lw_startTime = currTime;
        createNavBar(it);
        if(it.lw_type == "ace"){
          it.session.getMode().getNextLineIndent = function(){return "";}
          it.session.getMode().checkOutdent = function(){return false;}
        }

        var autoplay = getUrlVar('autoplay');
        if (autoplay !== "false"){
          livewritingResume(it);
        }
        else{
          $(".lw-current-time").text(convertTimeToString(0));
          livewritingPause(it);
        }
        document.body.onkeydown = function(e){
            if(e.keyCode==nonTypingKey.SPACE){
              // see if the editor is focused or not.
              // let's do codemirror for now.
              if(it.lw_pause){
                if(!it.hasFocus()){
                    livewritingResume(it);
                }
              }
              else { //if playing(

                $("#lw-hidden-inputfield").focus();
                livewritingPause(it);
              }


            }
        };


        var navbar = getUrlVar('navbar');
        if (navbar === "false"){
          // hide navbar
          toggleNavBar();
        }

        var startTime = currTime + it.lw_data[0]['t']/it.lw_playback;
        if(DEBUG)console.log("1start:" + startTime + " time: "+ currTime  + " interval:" + it.lw_data[0]['t']/it.lw_playback+ " currentData:",JSON.stringify(it.lw_data[0]));
        // let's draw inactive region.
        drawHistogram(it);
        var total_length = it.lw_data[it.lw_data.length-1]["t"]+1;
        var prevStartTime = 0
        for (var i=0; i< it.lw_data.length; i++){
          var starting_time = it.lw_data[i]['t'];
          if(it.lw_data[i]['t'] - prevStartTime> INACTIVE_SKIP_THRESHOLD){

            var width =(it.lw_data[i]['t'] - prevStartTime ) / total_length;
            if (width < 0.001) { // 0.001 means  1 px when the page width is 1000
              continue;
            }
            var inactive_region = $('<div></div>');
            inactive_region.css("left", (prevStartTime / total_length * 100.0) + "%");
            inactive_region.css("width", (width * 100.0) + "%");
            inactive_region.addClass("ui-slider-inactive-region");
            $(".livewriting_slider").append(inactive_region);
          }
          prevStartTime = it.lw_data[i]['t'];
        }


      };

      var livewritingMainfunction = function (message, option1, option2, option3){
          var it;

          if ($(this).length==1){
              it = $(this)[0];
          }
          else if ($(this) == Object){ // codemirror case I guess?
              it = this;
          }

          if (typeof(message) != "string"){
              alert("LiveWritingAPI: livewriting textarea need a string message");
              return it;
          }

          if (it == null || typeof(it) == "undfined"){
              alert("LiveWritingAPI: no object found for livewritingtexarea");
              return it;
          }

          if (message =="reset"){
              it.lw_startTime =  (new Date()).getTime();
          }
          else if (message == "create"){

              if (typeof(option2) != "object" &&typeof(option2) != "undefined" ){
                  alert("LiveWritingAPI: the 3rd argument should be the options array.");
                  return it;
              }
              if ( option1 != "textarea" && option1 != "codemirror" && option1 != "ace"){
                  alert("LiveWritingAPI: Creating live writing text area only supports either textarea, codemirror or ace editor. ");
                  return it;
              }
              if ($(this).length>1)
              {
                  alert("LiveWritingAPI: Please, have only one textarea in a page");
                  return it;
              }


              if(typeof option3 == "undefined")
                option3 = "";

              createLiveWritingTextArea(it, option1, option2, option3);

              return it;
          }
          else if (message == "post"){
              if(typeof(option1) != "string"){
                  alert("LiveWritingAPI: you have to specify url "+ option1);
                  return;
              }

              if(typeof(option3) != "function" || option3 == null){
                  alert("LiveWritingAPI: you have to specify a function that will run when server responded. \n"+ option2);
                  return;
              }

              var url = option1,
                  useroptions = option2,
                  respondFunc = option3;

              postData(it, url, useroptions, respondFunc);

          }
          else if (message == "play"){

              if (typeof(option1)!="string")
              {
                  alert("LiveWritingAPI: Unrecogniazble article id:"+option1);
                  return;
              }

              if (typeof(option2)!="string")
              {
                  alert("LiveWritingAPI: Unrecogniazble url address"+option2);
                  return;
              }

              var articleid = option1;

              if (it.lw_type == "codemirror"){
                  if (it.options.placeholder){
                      it.setOption("placeholder","");
                  }
              }

              playbackbyAid(it, articleid,option2);
          }
          else if (message == "playJson"){

              if (typeof(option1)!="object" && typeof(option1)!="string")
              {
                  alert("LiveWritingAPI: playJson require data object:"+option1);
                  return;
              }
              var data;
              if (typeof(option1)=="object"){
                data = option1;
              }else{
                try {
                    data = JSON.parse(option1);
                } catch (e) {
                    return false;
                }
              }

              it.lw_writemode = false;
              it.onkeyup = null;
              it.onkeypress = null;
              it.onkeydown = null
              it.onmouseup = null;
              it.onpaste = null;
              it.oncut = null;
              it.onscroll = null;
              it.ondragstart = null;
              it.ondragend = null;
              it.ondrop = null;
              it.ondblclick = null;
              it.oninput = null;
              if (it.lw_type == "codemirror"){
                  if (it.options.placeholder){
                      it.setOption("placeholder","");
                  }
              }
              playbackbyJson(it, data);
              return;
          }
          else if (message == "registerEvent"){

              if (typeof(option1)!="string")
              {
                  alert("LiveWritingAPI: Unrecogniazble article id:"+aid);
                  return;
              }

          }
          else if (message == "userinput"){
  // when user input event happens
  // save the event
              if(typeof(option1) != "number" || option1 == null){
                  alert("LiveWritingAPI: you have to specify a index number of the user-input function (can be any number) that will run when user-input is done"+ option1);
                  return;
              }

              it.onUserInput(option1, option2);
          }
          else if (message == "register"){
              if(typeof(option2) != "function" || option2 == null){
                  alert("LiveWritingAPI: you have to specify a function that will run when user-input is done"+ option1);
                  return;
              }

              if(typeof(option1) != "number" || option1 == null){
                  alert("LiveWritingAPI: you have to specify a function that will run when user-input is done"+ option1);
                  return;
              }

              it.userInputRespond[option1] = option2;
          }
          else if (message == "returnactiondata"){

              return getActionData(it);
          }
          return;
      }

      return livewritingMainfunction;
  }(lw_jQuery));
  // Export for node
  if (typeof module !== 'undefined' && module.exports) {
    /** @exports livewriting */
    module.exports = livewriting;
  }

}