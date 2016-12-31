var livewritingLink = localServerLink;
var app = angular.module('livewriting-backoffice', []);
app.controller('main-controller',[ '$scope', '$http', function($scope, $http) {
  $scope.list = [];
  $scope.totallist = [];
  $scope.offset = 0;
  $scope.maxOffset = 0;
  $scope.numArticlePerPage =20;
  $scope.error= false;
  $scope.link = livewritingLink + "?aid=";
  $scope.next = false;
  $scope.isLoggedIn = false;
  $scope.error_message="";
  $scope.offset = 0;
  $scope.numPerPage = 10;
  $scope.signin = function(){
    console.log("signin-email", $scope.signin_email);
    console.log("signin-password", $scope.signin_password);
    $http.post('/admin-login', {email:$scope.signin_email, password:$scope.signin_password}, {})
    .then(function(response){
        if(response.data == "admin-login-successful"){
          $scope.isLoggedIn = true;
          $scope.error_message="";
          $scope.retrieveArticles();
        }else if (response.data == "login-failed"){
          $scope.error_message = "Log-in information incorrect."
        }else if (response.data == "admin-login-failed"){
          $scope.error_message = "This page is just for administrators. Your email will be reported to the administrators."
        }
        else{
          alert(response.data);
        }
    });
  };

  $scope.retrieveArticles = function(){
    $http.post('/get-admin-articles',{offset:$scope.offset, num:$scope.numPerPage+1}, {})
    .then(function(response){
      if(response.data.length>0){
        $scope.next = false;
        if(response.data.length>$scope.numArticlePerPage)
          $scope.next = true;
        $scope.list = response.data.splice(0,$scope.numArticlePerPage);
        $scope.totallist = $scope.totallist.concat($scope.list);
      }
    }, function(response){
      console.log(JSON.stringify(response));
    });
  };

  $scope.nextList = function(){
    $scope.offset += $scope.numArticlePerPage;
    if($scope.offset>$scope.maxOffset){
      $scope.maxOffset = $scope.offset;
      $scope.retrieveArticles();
    }else{
      $scope.list = $scope.totallist.slice().splice($scope.offset, $scope.numArticlePerPage);
    }
  };

  $scope.prevList = function(){
    $scope.offset -= $scope.numArticlePerPage;
    $scope.list = $scope.totallist.slice().splice($scope.offset, $scope.numArticlePerPage);
    $scope.next = true;
  };

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
