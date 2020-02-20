var app = angular.module('livewriting-app', []);
var logginedEmail = null;
var localServerLink = localServerLink || "http://localhost:2401"
var resetlink = localServerLink;
var aboutlink = resetlink + "?aid=aboutechobin";
var posted_id = null;

var ValidateEmail = function(mail, alertFlag)
{
  if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(mail))
  {
    return true;
  }
  if(alertFlag)alert("You have entered an invalid email address!")
  return false;
}

app.controller('posting-dialog',[ '$scope', '$http', function($scope, $http) {
  $scope.isLoggedIn = function(){
    return ValidateEmail(logginedEmail);
  };
  $(".post-button").button();

  $scope.openSignin = function(){
    $("#post-complete-message").bPopup().close();
    $("#reset").show();
    $("#slider").slideReveal("show");
    $(".authform").addClass("lw_hidden");
    $(".signin").removeClass("lw_hidden");
  };

  $scope.openSignup = function(){
    $("#post-complete-message").bPopup().close();
    $("#reset").show();
    $("#slider").slideReveal("show");
    $(".authform").addClass("lw_hidden");
    $(".signup").removeClass("lw_hidden");
  };


}]);

app.controller('my-livewriting-list',[ '$scope', '$http', function($scope, $http) {
  $scope.list = [];
  $scope.totallist = [];
  $scope.offset = 0;
  $scope.maxOffset = 0;
  $scope.numArticlePerPage =10;
  $scope.error= false;
  $scope.link = resetlink + "?aid=";
  $scope.next = false;
  $scope.getList = function(){
    if(!ValidateEmail(logginedEmail))
      return;
    $http.post('/getlist', {offset:$scope.offset, num:$scope.numArticlePerPage+1,editor_type:"codemirror"}, {})
    .then(function(response){
      if(response.data.length>0){
        $scope.next = false;
        if(response.data.length>$scope.numArticlePerPage)
          $scope.next = true;
        $scope.list = response.data.splice(0,$scope.numArticlePerPage);
        $scope.totallist = $scope.totallist.concat($scope.list);
      }
      $scope.error = false;
    }, function(response){
      $scope.error = true;
    });
  };

  $scope.nextList = function(){
    $scope.offset += $scope.numArticlePerPage;
    if($scope.offset>$scope.maxOffset){
      $scope.maxOffset = $scope.offset;
      $scope.getList();
    }else{
      $scope.list = $scope.totallist.slice().splice($scope.offset, $scope.numArticlePerPage);
    }
  }

  $scope.prevList = function(){
    $scope.offset -= $scope.numArticlePerPage;
    $scope.list = $scope.totallist.slice().splice($scope.offset, $scope.numArticlePerPage);
    $scope.next = true;
  }

  var dateoptions = {
    year: "numeric", month: "short",
    day: "numeric", hour: "2-digit", minute: "2-digit"
  };

  $scope.timeToDate = function(time, time2){
    if(typeof time == "number"){
      return (new Date(time)).toLocaleDateString("en-us", dateoptions);
    }
    else if(typeof time2 == "string"){
      return (new Date(Number(time2))).toLocaleDateString("en-us", dateoptions);
    }
    else{
      alert(time, time2);
    }
  };
}]);

$(document).ready(function () {
    function cursorAct(cm){
        console.log("cursorAct : " + cm.getSelection());
    }
    var getUrlVars =  function(){
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for(var i = 0; i < hashes.length; i++)
        {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return vars;
    }
    //var editor = $("#livetext");

    var options = {
        lineNumbers: false,
        styleActiveLine: true,
        scrollbarStyle: "simple",
        matchBrackets: false,
        smartIndent : false,
        indentUnit:0,
        lineWrapping:true,
        mode:"Plain Text",
        height:"100%",
        backdrop: "gfm",
    };

    var parameters = getUrlVars();
    var editor

    // if (parameters.syntax != "undefined"){
    //   options.mode = parameters.syntax;
    // }
    CodeMirrorSpellChecker({
        codeMirrorInstance: CodeMirror,
    });

    $('#spell_check').on('change', function () {
        var bull = $('#spell_check').is(':checked')
        if (bull){
            editor.setOption("mode", 'spell-checker');
        }
        else{
            editor.setOption("mode", 'Plain Text');
        }
    })


    editor = CodeMirror.fromTextArea(document.getElementById("livetext"),options);
    editor.setSize("96%", "98%");

    var writeModeFunc = function(){
         $('#initial-message').bPopup({
            modalClose: false,
            opacity: 0.7,
            positionStyle: 'absolute',
            escClose :false
        });
        $("#postdata").show(); // show the button if write mode
    };

    var readModeFunc = function(){
        $("#postdata").hide(); // hide the button if read mode
    //    $("#reset").text("New");

    };

    editor.livewritingMessage = livewriting;
    editor.livewritingMessage("create", "codemirror", {name: "Sang's first run in CodeMirror",   writeMode:writeModeFunc, readMode:readModeFunc});

    // beginning of login

    $(".navigate").button();
    $("#signin").button().click(function(){
      $(".authform").addClass("lw_hidden");
      $(".signin").removeClass("lw_hidden");
    });

    $("#signup").button().click(function(){
      $(".authform").addClass("lw_hidden");
      $(".signup").removeClass("lw_hidden");
    });

    $("#signup2").button().click(function(){
      $(".authform").addClass("lw_hidden");
      $(".signup").removeClass("lw_hidden");
    });

    $("#signin2").button().click(function(){
      $(".authform").addClass("lw_hidden");
      $(".signin").removeClass("lw_hidden");
    });

    $("#signin3").button().css({ width: '150px', margin:'5px'}).click(function(){
      $('#initial-message').bPopup().close();
        $("#reset").show();
      slider.slideReveal("show");
      $(".authform").addClass("lw_hidden");
      $(".signin").removeClass("lw_hidden");
    });

    $("#signup3").button().css({ width: '150px', margin:'5px'}).click(function(){
      $('#initial-message').bPopup().close();
        $("#reset").show();
      slider.slideReveal("show");
      $(".authform").addClass("lw_hidden");
      $(".signup").removeClass("lw_hidden");
    });



    $("#signout").button().click(function(){
      $.ajax({
        url:"/logout",
        type:"get",
        success:function(data, textStatus, jqXHR){
          $(".authform").addClass("lw_hidden");
          $(".signin").removeClass("lw_hidden");

          $("#login-failed-message").text("");


            var scope = angular.element($("#list-livewriting")).scope();
            var popup_scope = angular.element($("#post-complete-message")).scope();
            scope.$apply(function () {
                scope.list = [];
                scope.totallist = []
            });
            posted_id = null
            logginedEmail = null;

            // popup_scope.isLoggedIn()

        },
        error:function( jqXHR, textStatus, errorThrown ){
          console.log(" error ",jqXHR, textStatus, errorThrown);
        }
      });
    });

    var updateEmailforArticle = function (id, email){
      if(email != logginedEmail){
        alert("logged in email does not match.(",email,",",logginedEmail,")")
        return;
      }

      $.ajax({
        url:"/updateemail",
        data:{
          id:id,
          email:email
        },
        type:"post",
        success:function(data, textStatus, jqXHR){
          var scope = angular.element($("#list-livewriting")).scope();
          scope.$apply(function () {
            scope.getList();
          });
        },
        error:function(data){
          console.error(data);
        }
      });
    }

    var getUser = function (userData) {
        $.ajax({
            url:"/getuser",
            data:userData,
            type:"post",
            success:function(data, textStatus, jqXHR){
                if (data==''){
                    signupHandler(userData)
                } else{
                    signinHandler(userData)
                }
            }
        });
    }

    var signupHandler = function(registdata){
        if (registdata) {
            $.ajax({
                url:"/signup",
                data:registdata,
                type:"post",
                success:function(data, textStatus, jqXHR){
                    if(data == "signup-failed"){
                        $("#signup-failed-message").text("The email address already exists.")
                    }
                    else if (ValidateEmail(data)){
                        $(".authform").addClass("lw_hidden");
                        $(".loggedin").removeClass("lw_hidden");
                        $(".signed-email").text(data);
                        if(posted_id != null){
                            updateEmailforArticle(posted_id, data);
                        }
                    }
                    else{
                        alert(textStatus);
                    }
                },
                error:function( jqXHR, textStatus, errorThrown ){
                    console.log(" error ",jqXHR, textStatus, errorThrown);
                }
            });
        }
        else{
            var email = $("#signup-email").val();
            if(ValidateEmail(email, true)){
                var password1 = $("#signup-pass1").val();
                var password2 = $("#signup-pass2").val();
                if (password1 == password2){
                    $("#signup-pass1").val("");
                    $("#signup-pass2").val("");

                    $.ajax({
                        url:"/signup",
                        data:{
                            email:email,
                            password:password1
                        },
                        type:"post",
                        success:function(data, textStatus, jqXHR){
                            if(data == "signup-failed"){
                                $("#signup-failed-message").text("The email address already exists.")
                            }
                            else if (ValidateEmail(data)){
                                $(".authform").addClass("lw_hidden");
                                $(".loggedin").removeClass("lw_hidden");
                                $(".signed-email").text(data);
                                if(posted_id != null){
                                    updateEmailforArticle(posted_id, data);
                                }
                            }
                            else{
                                alert(textStatus);
                            }
                        },
                        error:function( jqXHR, textStatus, errorThrown ){
                            console.log(" error ",jqXHR, textStatus, errorThrown);
                        }
                    });
                }
                else{
                    alert("Password do not match.");
                }
            }
        }
    };

    var signinHandler = function(logindata){
        var email
        var password
        if (logindata) {
            email = logindata.email;
            password = logindata.password
        }
        else{
           email = $("#signin-email").val();
           password = $("#signin-pass").val();
        }

            if(ValidateEmail(email)){
                $("#signin-pass").val("");
                $.ajax({
                    url:"/login",
                    data:{
                        email:email,
                        password: password
                    },
                    type:"post",
                    complete: function(){
                    },
                    success:function(data, textStatus, jqXHR){
                        if(ValidateEmail(data)){
                            $(".authform").addClass("lw_hidden");
                            $(".loggedin").removeClass("lw_hidden");
                            $("#login-failed-message").text("");
                            $(".signed-email").text(data);
                            logginedEmail = data;
                            var scope = angular.element($("#list-livewriting")).scope();
                            scope.$apply(function () {
                                scope.getList();
                            });

                            if(posted_id != null){
                                updateEmailforArticle(posted_id, data);
                            }
                        }
                        else if (data == "Oops! Wrong password." || data == ""){
                            $("#login-failed-message").text("Oops! Wrong password.")
                        }
                        else if (data == "No user found."){
                            $("#login-failed-message").text("No user found.")
                        }
                        else if (data == "You have an account already with the email address"){
                            $("#login-failed-message").text("You have an account already with the email address")
                        }
                        else{
                            alert(textStatus);
                        }


                    },
                    error:function( jqXHR, textStatus, errorThrown ){
                        console.log(" error ",jqXHR, textStatus, errorThrown);
                    }
                });
        }
    };

    $("#submit-signin").click(function (){
        signinHandler()
    });
    $("#submit-signup").click(function (){
        signupHandler()
    });

    $("#signin-pass").keyup(function(ev){
      if (ev.which == 13){
        signinHandler();
      }
    });

    $("#signup-pass2").keyup(function(ev){
      if (ev.which == 13){
        signupHandler();
      }
    });

    $.ajax({
      url:"/profile",
      type:"get",
      success:function(data, textStatus, jqXHR){
        if(ValidateEmail(data)){
          $(".authform").addClass("lw_hidden");
          $(".not-loggedin").addClass("lw_hidden");
          $(".loggedin").removeClass("lw_hidden");
          $(".signed-email").text(data);
          logginedEmail = data;
          var scope = angular.element($("#list-livewriting")).scope();
          scope.$apply(function () {
            scope.getList();
          });
        }
      },
      error:function( jqXHR, textStatus, errorThrown ){
        console.log("profile error ",jqXHR, textStatus, errorThrown);
      }
    });

    $(".yourwriting").button().click(function(){
      $('#list-livewriting').bPopup({
        modalClose: false,
        opacity: 0.7,
        positionStyle: 'absolute',
        escClose :false
      });
    });

    $(".list-livewriting-close").button().click(function(){
      $('#list-livewriting').bPopup().close();
    })
    // end of login

    $("#postdata").button().css({ width: '150px', margin:'5px'}).click(function(){
         $('#post-message').bPopup({
            modalClose: false,
            opacity: 0.7,
            positionStyle: 'absolute',
            escClose :false
        });

        var useroptions = {};

        useroptions["livewriting_consent"] = $("#livewriting_consent").prop("checked");
        useroptions["url"] = localServerLink;

        if(logginedEmail)useroptions["email"] = logginedEmail;
        editor.livewritingMessage("post","/post", useroptions, function(state, aid){
          $('#post-message').bPopup().close();
          articlelink =aid;
          $('#post-complete-message').bPopup({
            modalClose: false,
            opacity: 0.7,
            positionStyle: 'absolute',
            escClose :false
          });
          $("#post-link").text(articlelink);
          ZeroClipboard.setData( "text/plain", articlelink);
          posted_id = aid;

            var scope = angular.element($("#list-livewriting")).scope();
            scope.$apply(function () {
              scope.getList();
            });
        });
    });



    $("#reset").button().css({ width: '150px', margin:'5px'}).click(function(){
        window.open(resetlink, '_self');
    });

    $("#start").button().css({ width: '150px', margin:'5px'}).click(function(){
        $('#initial-message').bPopup().close();
        editor.livewritingMessage("reset");
        editor.focus();
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
        //console.log(obj);
        },
        shown: function(obj){
            $("#trigger").html('&gt;');
            obj.toggleClass(".left-shadow-overlay");
            obj.css({opacity:'0.9'});
        },
        hide: function(obj){
        },
        hidden: function(obj){
            $("#trigger").html('&lt;');
            obj.toggleClass(".left-shadow-overlay");
            editor.focus();
            obj.css({opacity:'0.5'});
        }
    });

    editor.on("click",function(){
        slider.slideReveal("hide");
    });

    var client = new ZeroClipboard($("#copytoclipboard"));
    client.on( "aftercopy", function( event ) {
        alert("Copied text to clipboard: " + event.data["text/plain"] );
    } );

    $("#copytoclipboard").button().css({width:'250px', margine:'5px'});

    $("#play").button().css({ width: '150px', margin:'5px'}).click(function(){
        var windowObjectReference = window.open(articlelink,"win2");
    });
    $("#close").button().css({ width: '150px', margin:'5px'}).click(function(){
        $('#post-complete-message').bPopup().close();
    });



    // facebook signin start

    $('#facebook-button').on('click', function() {
        // Initialize with your OAuth.io app public key
        OAuth.initialize('HwAr2OtSxRgEEnO2-JnYjsuA3tc');
        // Use popup for oauth
        // Alternative is redirect
        OAuth.popup('facebook').then(facebook => {

            // Retrieves user data from oauth provider
            // Prompts 'welcome' message with User's email on successful login
            // #me() is a convenient method to retrieve user data without requiring you
            // to know which OAuth provider url to call
            facebook.me().then(data => {
                var loginData = {
                    email:data.email,
                    password:"secretKey",
                }
                getUser(loginData)
            });
            // Retrieves user data from OAuth provider by using #get() and
            // OAuth provider url
        });
    })
    // facbook signin end




    // google signin start


    $('#google-button').on('click', function() {
        // Initialize with your OAuth.io app public key
        OAuth.initialize('HwAr2OtSxRgEEnO2-JnYjsuA3tc');
        // Use popup for oauth
        // Alternative is redirect
        OAuth.popup('google').then(google => {

            // Retrieves user data from oauth provider
            // Prompts 'welcome' message with User's email on successful login
            // #me() is a convenient method to retrieve user data without requiring you
            // to know which OAuth provider url to call
            google.me().then(data => {
                var loginData = {
                    email:data.email,
                    password:"secretKey",
                }
                getUser(loginData)
            });
            // Retrieves user data from OAuth provider by using #get() and
            // OAuth provider url

        });
    })

    // google signin end

    // github singIn start
    $('#github-button').on('click', function() {
        // Initialize with your OAuth.io app public key
        OAuth.initialize('HwAr2OtSxRgEEnO2-JnYjsuA3tc');
        // Use popup for oauth
        // Alternative is redirect
        OAuth.popup('github').then(github => {

            // Retrieves user data from oauth provider
            // Prompts 'welcome' message with User's email on successful login
            // #me() is a convenient method to retrieve user data without requiring you
            // to know which OAuth provider url to call
            github.me().then(data => {
                var loginData = {
                    email:data.email,
                    password:"secretKey",
                }
                getUser(loginData)
            });
            // Retrieves user data from OAuth provider by using #get() and
            // OAuth provider url

        });
    })
    // github signin end


    //twitter signin start

    $('#twitter-button').on('click', function() {
        // Initialize with your OAuth.io app public key
        OAuth.initialize('HwAr2OtSxRgEEnO2-JnYjsuA3tc');
        // Use popup for oauth
        // Alternative is redirect
        OAuth.popup('twitter').then(twitter => {

            // Retrieves user data from oauth provider
            // Prompts 'welcome' message with User's email on successful login
            // #me() is a convenient method to retrieve user data without requiring you
            // to know which OAuth provider url to call
            twitter.me().then(data => {
                var loginData = {
                    email:data.email,
                    password:"secretKey",
                }
                getUser(loginData)
            });
            // Retrieves user data from OAuth provider by using #get() and
            // OAuth provider url

        });
    })

    //twitter signin end

























    // function statusChangeCallback(response) {
    //     console.log(response);
    //     if (response.status === 'connected') {
    //         console.log('connected')
    //         testAPI();
    //     } else {
    //         // The person is not logged into your app or we are unable to tell.
    //         console.log('Please log into this app.')
    //     }
    // }
    //
    // checkLoginState = function() {
    //     FB.getLoginStatus(function(response) {
    //         if (document.cookie !== ""){
    //             statusChangeCallback(response);
    //         }
    //     });
    // }
    //
    // window.fbAsyncInit = function() {
    //     FB.init({
    //         appId: '1504739526323404',
    //         xfbml: true,
    //         cookie: true,
    //         version: 'v3.2'
    //     });
    //
    //
    //     FB.getLoginStatus(function(response) {
    //         if(document.cookie !== ""){
    //             statusChangeCallback(response);
    //         }
    //     });
    //
    // };
    //
    // (function(d, s, id) {
    //     var js, fjs = d.getElementsByTagName(s)[0];
    //     if (d.getElementById(id)) return;
    //     js = d.createElement(s); js.id = id;
    //     js.src = "https://connect.facebook.net/en_US/sdk.js";
    //     fjs.parentNode.insertBefore(js, fjs);
    // }(document, 'script', 'facebook-jssdk'));
    //
    //
    // function testAPI() {
    //     console.log('Welcome!  Fetching your information.... ');
    //     FB.api('/me',{fields: 'email'}, function(response) {
    //         console.log(response, "facebook");
    //         var loginData = {
    //             email:response.email,
    //             password:"secretKey",
    //         }
    //         getUser(loginData)
    //     });
    // }
    // // facbook singin end
    //
    //
    //
    //
    // // google singIn start
    //
    //
    // function onSuccess(googleUser) {
    //     var profile = googleUser.getBasicProfile();
    //     console.log(profile.getId(), "google");
    //     var loginData = {
    //         email:profile.getEmail(),
    //         password:"secretKey",
    //     }
    //     getUser(loginData)
    // }
    // function onFailure(error) {
    //     console.log(error);
    // }
    //
    //
    // $(window).load((function () {
    //     renderButton()
    // }))
    //
    // function renderButton(){
    //     gapi.signin2.render('my-signin2', {
    //         'scope': 'profile email',
    //         'onsuccess': onSuccess,
    //         'onfailure': onFailure
    //     });
    // }
    //
    //
    // function googlesignOut() {
    //     var auth2 = gapi.auth2.getAuthInstance();
    //     auth2.signOut().then(function () {
    //
    //     });
    // }
    //
    // // google singIn end
    //
    // // github singIn start
    // $('#github-button').on('click', function() {
    //     // Initialize with your OAuth.io app public key
    //     OAuth.initialize('HwAr2OtSxRgEEnO2-JnYjsuA3tc');
    //     // Use popup for oauth
    //     // Alternative is redirect
    //     OAuth.popup('github').then(github => {
    //
    //         // Retrieves user data from oauth provider
    //         // Prompts 'welcome' message with User's email on successful login
    //         // #me() is a convenient method to retrieve user data without requiring you
    //         // to know which OAuth provider url to call
    //         github.me().then(data => {
    //             console.log(data.raw.user.node_id, "github");
    //             var loginData = {
    //                 email:data.email,
    //                 password:"secretKey",
    //             }
    //             getUser(loginData)
    //         });
    //         // Retrieves user data from OAuth provider by using #get() and
    //         // OAuth provider url
    //         github.get('/user').then(data => {
    //
    //         })
    //     });
    // })
    // // github singIn end





});
