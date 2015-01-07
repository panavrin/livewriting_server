/*jslint browser: true*/
/*global $, jQuery, alert*/
$(document).ready(function () {
    var resetlink = "http://localhost:9137";
    var aboutlink = resetlink + "?aid=aboutechobin";

    "use strict";
    $("#livetext").focus();
    $("#livetext").attr("spellcheck", false);
    var articlelink = "dummylink.com/thisisdummylink";
    var writeModeFunc = function(){
         $('#initial-message').bPopup({
            modalClose: false,
            opacity: 0.7,
            positionStyle: 'absolute',
            escClose :false
        });
        $("#postdata").show(); // hide the button if read mode 
    };
    var readModeFunc = function(){
        $("#postdata").hide(); // hide the button if read mode 
        $("#reset").text("New");
    };
   

    var lw = $("#livetext").lwtextarea({name: "Sang's first run",   writeMode:writeModeFunc, readMode:readModeFunc});
    //console.log(lw.name + " is ready.");
    //console.log($(lw).name + " is ready2.");

    $("#postdata").button().css({ width: '150px', margin:'5px'}).click(function(){
         $('#post-message').bPopup({
            modalClose: false,
            opacity: 0.7,
            positionStyle: 'absolute',
            escClose :false
        });
        
        $("#livetext").postData("/post",function(state, aid){
        //    alert(state + ":" + aid);
            $('#post-message').bPopup().close();
            articlelink = "http://localhost:9137?aid="+aid;
            $('#post-complete-message').bPopup({
                modalClose: false,
                opacity: 0.7,
                positionStyle: 'absolute',
                escClose :false
            });  
            
           
            $("#post-link").text(articlelink);    
            ZeroClipboard.setData( "text/plain", articlelink);

        });
        
    });
     $("#reset").button().css({ width: '150px', margin:'5px'}).click(function(){
            window.open(resetlink, '_self');
    });

    $("#start").button().css({ width: '150px', margin:'5px'}).click(function(){
        $('#initial-message').bPopup().close();
        lw.resetTimer();
        $("#livetext").focus();
        $("#reset").show(); // hide the button if read mode 
    });

    $(".about").button().css({ width: '150px', margin:'5px'}).click(function(){
        var windowObjectReference = window.open(aboutlink,"win1");
    });
     $("#play").button().css({ width: '150px', margin:'5px'}).click(function(){
        var windowObjectReference = window.open(articlelink,"win2");
    });
    $("#close").button().css({ width: '150px', margin:'5px'}).click(function(){
        $('#post-complete-message').bPopup().close();
    });
    var client = new ZeroClipboard($("#copytoclipboard"));
    client.on( "aftercopy", function( event ) {
        alert("Copied text to clipboard: " + event.data["text/plain"] );
    } );

    $("#copytoclipboard").button().css({width:'250px', margine:'5px'});
   
    
     var slider = $("#slider").slideReveal({
        width: 250,
        push: false,
        position: "right",
        speed: 600,
        trigger: $("#trigger"),
        autoEscape: true,
        show: function(obj){
        console.log(obj);
        },
        shown: function(obj){
            console.log(obj);
            $("#trigger").html('&gt;');
            obj.toggleClass(".left-shadow-overlay");
            obj.css({opacity:'0.9'});
        },
        hide: function(obj){
            console.log(obj);
        },
        hidden: function(obj){
            console.log(obj);
            $("#trigger").html('&lt;');
            obj.toggleClass(".left-shadow-overlay");
            lw.focus();
            obj.css({opacity:'0.5'});
        }
    });
    $("#livetext").click(function(){
        slider.slideReveal("hide");
    });
});