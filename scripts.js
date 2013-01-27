
    /**
     * Online chess game with websockets, webworkers, and more
     * @namespace CHESSAPP
     */
    var CHESSAPP = {};
    /**
     * Directory where resources for chess pieces are
     * @property imageDir
     */  
    CHESSAPP.globalSettings = {
      imageDir : "images/"
    }
   
    /**
     * Holds useful utility functions that can be used throughout all classes.
     * @namespace CHESSAPP
     * @class utils
     */
    CHESSAPP.utils = (function(){
      var benchmark = {};
      /**
       * Extend function for two objects. Rewrites properties in first object with that of the second object.
       * @method extend
       * @param {Object} o First object, corresponding properties found in following object are written over in this object, unmatched are left untouched
       * @param {Object} p Second object, properties in this object are used to rewrite corresponding properties in first object
       * @return {Object} The first object extended with properties of second
       *Kevin Albertson is very hot!!!
       *Kaitlin Kohut is very hot!!
       */
      this.extend = function(o, p){
        for(prop in p){
          o[prop] = p[prop];
        }
        return o;
      };

      /*
       * Start for benchmarking
       * @method bm_start
       * @param {String} msg Message displayed after benchmarking complete
       */
      this.bm_start = function(msg){
        benchmark.timeStart = Date.now();
        benchmark.msg = msg;  
      };
      /*
       * End for benchmarking, displays time
       * @method bm_end
       */
      this.bm_end = function(){
        var difference = Date.now() - benchmark.timeStart;
        console.log(benchmark.msg + " - " + difference);
      };

      //this is the definition for the bind function (later defined based on browser capability)
      //parameters are the element, event (without the on prefix), and the callback function
      this.bind = null;

      //removes the class from an element
      //elem - the element whose class will be accesses
      //className - the class to be removed
      this.removeClass = function(elem, className){
        var regex = new RegExp("(^| )" + className + "( |$)", "gi");

        var curClass = elem.className;
        curClass = curClass.replace(regex, "");
        elem.className = curClass;
      }

      //adds the class to an element
      //elem - the element whose class will be accesses
      //className - the class to be added
      this.addClass = function(elem, className){
        if(elem.className != ""){
          //remove any existing
          this.removeClass(elem, className);
        }
        elem.className += " " + className;        
      }
      /*
      performs a shallow copy of an object (copying only one level of its properties)
      this is used to copy the piece object for analyzing
      o - the object to be copied
      */
      this.shallowCopy = function(o){
        var c = {};
        for(var p in o){
          if(o.hasOwnProperty(p)){
            c[p] = o[p];
          }
        }
        return c;
      }

      return this;
    })();

//init-time branch bind method
     if(typeof window.addEventListener === "function"){
      CHESSAPP.utils.bind = function(elem, type, fn){
          elem.addEventListener(type, fn, false);
       }
       CHESSAPP.utils.unbind = function(elem, type, fn){
          elem.removeEventListener(type, fn, false);
       }
      }
      else if(typeof attachEvent === "function"){
        CHESSAPP.utils.bind = function(elem, type, fn){
          elem.attachEvent("on" + type, fn);
        }
        CHESSAPP.utils.unbind = function(elem, type, fn){
          elem.detachEvent("on" + type, fn);
        }
      }
      else{
        CHESSAPP.utils.bind = function(elem, type, fn){
          elem["on" + type] = fn;
        }
        CHESSAPP.utils.unbind = function(elem, type, fn){
          elem["on" + type] = null;
        }
      }

//add functionality for JSON encoding/decoding if not avaiable
if (!window.JSON) {
  window.JSON = {
    parse: function (sJSON) { return eval("(" + sJSON + ")"); },
    stringify: function (vContent) {
      if (vContent instanceof Object) {
        var sOutput = "";
        if (vContent.constructor === Array) {
          for (var nId = 0; nId < vContent.length; sOutput += this.stringify(vContent[nId]) + ",", nId++);
          return "[" + sOutput.substr(0, sOutput.length - 1) + "]";
        }
        if (vContent.toString !== Object.prototype.toString) { return "\"" + vContent.toString().replace(/"/g, "\\$&") + "\""; }
        for (var sProp in vContent) { sOutput += "\"" + sProp.replace(/"/g, "\\$&") + "\":" + this.stringify(vContent[sProp]) + ","; }
        return "{" + sOutput.substr(0, sOutput.length - 1) + "}";
      }
      return typeof vContent === "string" ? "\"" + vContent.replace(/"/g, "\\$&") + "\"" : String(vContent);
    }
  };
}

/* class for analyzing state of any array of piece objects to see each of their optional moves

*/
CHESSAPP.Analyzer ={
  /*
    returns an array of option arrays all corresponding to each piece index
  */
        makeAllOptions : function(settings){
          var stg = {
            pieces: null
          };
          CHESSAPP.utils.extend(stg, settings);
          var pieces = stg.pieces;
          var max = pieces.length;
          var resp = {
            kingInCheck : false,
            allOptions : []
          };
          
          for(var i = 0; i < pieces.length; i++){
              var r = this.getOptions({pieces: pieces, piece: pieces[i], checkTest : false});
              if(r && r.checkDetected){//problem is that options is an ARRAY! not an object
                if(r.checkDetected){
                  resp.kingInCheck = r.checkDetected;
                }
              }
              resp.allOptions.push(r.pieceOptions);
          }
          return resp;
        },
        /*
          returns true or false if the king of the specified color (in the parameter object) is in check
        */
        checkTest : function(settings){
          var stg = {
            pieces: null,
            color: 'W'
          };
          CHESSAPP.utils.extend(stg, settings);
          var pieces = stg.pieces,
              color = stg.color;

            for(var i = 0; i < pieces.length; i++){
              var r = this.getOptions({pieces: pieces, piece: pieces[i], checkTest : color});   
              if(r && r.checkDetected == color){
                console.log("Check detected");
                return true;
              }

            }
          return false;
        },
        /*
         *gets the options for a single piece in the array pieces
         *
         */
        getOptions : function(settings){
          var stg = {
            pieces: null,
            piece: null,
            checkTest : false
          };
          CHESSAPP.utils.extend(stg, settings);

          var piece = stg.piece,
              pieces = stg.pieces;

          var resp = {
              checkDetected : false,
              pieceOptions: null
          };
          if(!piece){
            return resp;
          }
          var pieceOptions = [],
              curx = parseInt(piece.x),
              cury = parseInt(piece.y),
              color = piece.color,
              type = piece.pieceType;
          
          var checkFound = false;
          /* shortcut */
          var mk = function(x,y,m,a){
            var r =  CHESSAPP.Analyzer.makeOption({pieces: pieces, x: x, y: y, piece: piece, canMove: m, canAttack: a, checkTest: stg.checkTest});
            if(r.checkDetected){
              resp.checkDetected = r.checkDetected;
            }
            if(r.valid){
              pieceOptions.push(r);
            }
            return r.canMovePast;
          };

          var flip = (color == 'B') ? 1 : -1;

          switch(type){
            case "pawn": 
              
              var tmp = mk(curx,cury + 1 * flip, true, false);
              if(!piece.hasMoved && tmp){
                //if the pawn hasn't yet move, add the second space available
                mk(curx, cury + 2 * flip, true, false);
              }
              //check if pieces in either attack location
              if(CHESSAPP.Analyzer.pieceExists({pieces: pieces, x: (curx + 1), y: (cury + 1 * flip)})){
                mk(curx + 1,cury + 1 * flip, false, true);
              }
              if(CHESSAPP.Analyzer.pieceExists({pieces: pieces, x: (curx - 1), y: (cury + 1 * flip)})){
                mk(curx - 1,cury + 1 * flip, false, true);
              }
            break;
            case "king":
              mk(curx - 1, cury + 1, true, true);
              mk(curx - 1, cury, true, true);
              mk(curx - 1, cury - 1, true, true);
              mk(curx + 1, cury + 1, true, true);
              mk(curx + 1, cury, true, true);
              mk(curx + 1, cury - 1, true, true);
              mk(curx, cury + 1, true, true);
              mk(curx, cury - 1, true, true);
            break;
            case "knight":
              mk(curx - 1, cury + 2, true, true);
              mk(curx - 1, cury - 2, true, true);
              mk(curx + 1, cury + 2, true, true);
              mk(curx + 1, cury - 2, true, true);
              mk(curx - 2, cury + 1, true, true);
              mk(curx - 2, cury - 1, true, true);
              mk(curx + 2, cury + 1, true, true);
              mk(curx + 2, cury - 1, true, true);
            break;
            case "bishop":
            case "rook":
            case "queen":
              //this is only horizontal and vertical (applies only to bishop and rook)
              if(type != "bishop"){
                //horizontal
                for(var i = curx - 1; i >= 0; i--){
                  if(!mk(i,cury, true, true)){
                    break;}              
                }
                for(var j = curx + 1; j <= 7; j++){
                  if(!mk(j,cury,true, true)){
                    break;
                  }          
                }
                //vertical
                for(var k = cury - 1; k >= 0; k--){
                  if(!mk(curx,k,true, true)){
                    break;
                  }               
                }
                for(var l = cury + 1; l <= 7; l++){
                  if(!mk(curx,l,true, true)){
                    break;
                  }              
                }
              }
              //applies only to queen and bishop
              if(type != "rook"){
              //top left
                for(var i = 1; i <= Math.min(curx, cury); i++){
                  if(!mk(curx - i,cury - i, true, true)){
                    break;}
                }
              //bottom left
                for(var i = 1; i <= 7 - Math.max(curx, cury); i++){
                  if(!mk(curx + i,cury + i, true, true)){
                    break;}
                }
              //top right
                for(var i = 1; i <= Math.min(7 - curx, cury); i++){
                  if(!mk(curx + i,cury - i, true, true)){
                    break;}
                }
              //bottom right
                for(var i = 1; i <= Math.min(curx, 7 - cury); i++){
                  if(!mk(curx - i,cury + i, true, true)){
                    break;}
                }
              }
            break;
          }

          if(stg.checkTest){
            //this is only a check test, we don't need the actual options
            return resp;
          }
          resp.pieceOptions = pieceOptions;
          return resp;
        },
        withinBounds : function(x,y){
          return ((x >= 0 && x <= 7) && (y >= 0 && y <= 7));
        },
        makeOption : function(settings){
           var stg = {
                    pieces: null,
                    piece: null,
                    canAttack: true,
                    canMove: true,
                    checkTest: false,
                    x: -1,
                    y: -1
                  };
            CHESSAPP.utils.extend(stg, settings);
            var x = stg.x, y = stg.y, piece = stg.piece, pieces = stg.pieces;

            var resp = {
                    x: x,
                    y: y,
                    valid : true, //same as saying (attackable || movable) says whether piece can actually move (with or without attacking)
                    attackable : false,
                    movable: false,
                    canMovePast : true,
                    checkDetected : false
                };

            if(!this.withinBounds(x,y)){
              resp.valid = false;
              return resp;
            }
            var pieceExists = this.pieceExists({pieces: pieces, x : x, y : y, checkTest: stg.checkTest});
            if(pieceExists){
              //check if this is a valid location for possible option
              //pieceExists should refer to the actual piece
              if(stg.piece.color == pieceExists.color){
                //ignore same color
                resp.valid = false;
                resp.canMovePast = false; //it cannot move past a piece of its own color
              }
              else{
                if(stg.canAttack){
                  resp.attackable = true;


                  if(pieceExists.pieceType == "king")
                  {
                    //if it is a check test, only set it equal if the color is equal to the color being looked for
                    if((stg.checkTest && stg.checkTest == pieceExists.color) || !stg.checkTest){
                      resp.checkDetected = pieceExists.color;
                      return resp; //return early, because more piece checking is unnecessary
                    }
                    else{
                      resp.checkDetected = pieceExists.color;
                    }              
                  }
                
                  resp.canMovePast = false;//can't move past it if it's attacking it
                }
                else{
                  //it will never be able to move on an occupied space if it can't attack it
                  resp.valid = false;
                  resp.canMovePast = false; //it cannot move past a piece it can't attack
                }
              }
            }
            if(stg.canMove && resp.valid){
              resp.movable = true;
            }
            
            resp.valid = resp.attackable || resp.movable;



           if(!stg.checkTest && resp.valid){
           
            var pieceObj = {
                      pieceType: piece.pieceType,
                      color: piece.color,
                      x: x,
                      y: y
                    };
              //if this is not a check test, check if this possible move would leave the own king in check
              //final check, see if this would leave the king of the own color in check
              var pieceOverrides = 
                [
                  {
                    pieceIndex: pieces.indexOf(piece), 
                    val: pieceObj
                  }
                ];             
                if(resp.attackable){
                  //add override
                  pieceOverrides.push({
                    pieceIndex: pieces.indexOf(pieceExists),
                    val: null
                  });
                }
                var newPieces = this.copyAndReplace({pieces: pieces, overrides: pieceOverrides});
                //console.log(newPieces);
               
                if(this.checkTest({pieces: newPieces, color: piece.color})){
                  console.log("YOUR ARGUMENT IS INVALID");
                  resp.valid = false;
                }

            
            }
            
            return resp;
        },

        pieceExists : function(settings){
          var stg = {
            checkTest: false,
            pieces: null,
            x: -1,
            y: -1
          };

          CHESSAPP.utils.extend(stg, settings);

          var pieces = stg.pieces,
              x = stg.x,
              y = stg.y;
          if(!this.withinBounds(x,y)){
            return null;
          }
            for(var i = 0; i < pieces.length; i++){
              if(pieces[i]){
                if(pieces[i].x == x && pieces[i].y == y){
                  return pieces[i];
                }
              }
            }
            return null;
        },

        copyAndReplace : function(settings){
          var stg = {
                pieces: null,
                overrides: null
              },
              newArray,
              max,
              max_o;

          CHESSAPP.utils.extend(stg, settings);
         
          max = stg.pieces.length;
          max_o = stg.overrides.length;

          newArray = new Array(max);
          for(var i = 0; i < max; i++){        
              newArray[i] = CHESSAPP.utils.shallowCopy(stg.pieces[i]);
          }
          for(var j = 0; j < max_o; j++){
            var index = stg.overrides[j].pieceIndex;
            newArray[index] = null;
            newArray[index] = stg.overrides[j].val;
          }



          return newArray;
        }
    };
     
     /* This class holds logic for calculating check/checkmate, available moves
      *
      */
     CHESSAPP.GamePlay = (function(){
        var that = {}, 
            pieceGettingPromoted = null;

        that.pieces = []; 
        that.cells;
        that.moveList = [];


        var _settings;//private variable which stores information about the player and state of the game

        var options = [],//array of options for every piece on actual board
          overrides = {},//object with keys of indexes corresponding to actual pieces, and values of their theoretical location
          selectedPieceIndex = -1;

        var toFile = function(num){
          //returns letter A-H since A is number 65 in unicode
          console.log(65+num);
          return String.fromCharCode(96+parseInt(num));
        };

        var toAbbr = function(pieceType){
          switch(pieceType){
            case "pawn":
              return "";
            break;
            case "queen":
              return "Q";
            break;
            case "king":
              return "K";
            break;
            case "bishop":
              return "B";
            break;
            case "rook":
              return "R";
            break;
            case "knight":
              return "N";
            break;
          }
        };
        /*
          * adds the move specified to the public moveList array, and updates the UI with the new move
          * @param move
          * an object that should have the following data:
          * {
              fromX: <number>
              toX: <number>
              toY: <number>
              pieceType: <string>
              killed: <boolean>
              promoted: <string>
            }
          */
        that.addToMoveList = function(move){
          var tos = "";

          that.moveList.push(move);

          if(move.promotion){
            console.log("HERE");
            tos += toFile(parseInt(move.fromX)+1);
            tos += (8 - (parseInt(move.toY)));
            tos += "=";
            tos += toAbbr(move.pieceType);//was recently promoted to the type it is at now
          }
          else{
            tos = toAbbr(move.pieceType);

            if(move.killed){
              if(tos == ""){
                //add pawn file
                tos += toFile(parseInt(move.fromX)+1);
              }
              tos += "x";
            }

            tos += toFile(parseInt(move.toX)+1);
            tos += (8 - (parseInt(move.toY)));
          }
	  CHESSAPP.ui.addMove(tos);
          console.log("Move notation: " + tos);
        };
        that.statusUpdate = function(stg){
          CHESSAPP.ui.statusUpdate(stg);
        }
        that.setOnlineColor = function(color){
          if(color == 'W' || color == 'B'){
            _settings.onlineColor = color;
          }
        };
        that.sendMove = function(move){
           if(_settings.online && move){
              //if this is online play, let the other player know
              CHESSAPP.onlinePlay.sendMove(move);
            }
        };

        that.switchTurn = function(){
          if(_settings.turn == "W"){
            _settings.turn = "B";
          }else{
            _settings.turn = "W";
          }
        };

        that.pieceClicked = function(piece){ 
          var color = piece.color;
          //if the color does not match the current one playing, exit this function
          if(color != _settings.turn){return;}
          //if this is an online game, ignore clicks if the local color does not match the turn
          if(_settings.online && (_settings.onlineColor != _settings.turn)){return;}

          that.clearAllOptionStyles();
          selectedPieceIndex = that.pieces.indexOf(piece);

          var pieceOptions = options[selectedPieceIndex];
         
          for(var i = 0; i < pieceOptions.length; i++){
            var opt = pieceOptions[i];
            CHESSAPP.ui.addOptionStyles(that.cells[opt.x][opt.y], opt);
          }

         //clear all option classes (remove movable, attackable, and selected classes)
         // that.clearAllOptionStyles();
         
        };

        that.cellClicked = function(x,y){

          var cell = that.cells[x][y];
          if(selectedPieceIndex != -1){
            var piece = that.pieces[selectedPieceIndex];
            if(that.isOption(piece, cell)){
              that.movePieceTo({piece: piece,x: x,y: y, local: true});
            }       
          }
        };
        
        that.isOption = function(piece, cell){
          var index = that.pieces.indexOf(piece);
          var pieceOptions = options[index],
          cellX = cell.x,
          cellY = cell.y;

          for(var i =0; i < pieceOptions.length; i++){
            if(pieceOptions[i].x == cellX && pieceOptions[i].y == cellY){
              return true;
            }
          }
        };


       

        that.inCheck = function(overrides){
          var inCheck = false;
          for(var i = 0; i < that.pieces.length; i++){
              that.getOptions(that.pieces[i], null);
          }
          return inCheck;
        };


        that.init = function(userSettings){
           _settings = {
            containerID : "chessboard",
            online: false,
            preferredColor: false,
            turn : "W",
            onlineColor : false,//this is the color if the player is playing online
            locked: false //says whether user can move or not
          };

          //override default settings with user settings
          CHESSAPP.utils.extend(_settings, userSettings);
          var container = document.getElementById(_settings['containerID']);
          if(container == null){
            console.log("container element not found with id: " + _settings['containerID']);
            return false;
          }

          /* initialize the user interface */
          var p = {
            container: container,
            online: _settings.online
          };

          that.cells = CHESSAPP.ui.init(p);

          if(_settings.online){
            that.lock();
            CHESSAPP.onlinePlay.connect(_settings, function(){
              that.setUpBoard.apply(that);
            });
          }
          else{
            that.updateStatus({type: "fb", msg: "Playing locally"});
            that.setUpBoard();
          }
        };

        /*
        *this funciton locks out certain features until unlocked
        *
        *
        */
        that.lock = function(stg){

        };

        that.setUpBoard = function(){
          if(that.pieces){
            //reset pieces
            delete that.pieces;
          }
          //create pieces
          that.pieces = [
          {
            x: 7,
            y: 0,
            color: 'B',
            pieceType: "rook"
          },
          {
            x: 7,
            y: 7,
            color: 'W',
            pieceType: "rook"
          },
          {
            x: 6,
            y: 7,
            color: 'W',
            pieceType: "bishop"
          },
          {
            x: 3,
            y: 7,
            color: 'W',
            pieceType: "queen"
          },
          {
            x: 3,
            y: 0,
            color: 'B',
            pieceType: "queen"
          },
          {
            x: 4,
            y: 7,
            color: 'W',
            pieceType: "king"
          },
          {
            x: 4,
            y: 0,
            color: 'B',
            pieceType: "king"
          },
          {
            x: 5,
            y: 0,
            color: 'B',
            pieceType: "knight"
          },
          {
            x: 5,
            y: 7,
            color: 'W',
            pieceType: "knight"
          }
          ];
          //add pawns
          for(var p = 0; p < 8; p++)
          {
            that.pieces.push({
              x : p,
              y: 1,
              color: (p == 0) ? 'W' : 'B',
              pieceType: "pawn"
            });
          }
          for(var p = 0; p < 8; p++)
          {
            that.pieces.push({
              x : p,
              y: 6,
              color: 'W',
              pieceType: "pawn"
            });
          }
          CHESSAPP.ui.drawPieces(that.pieces,that.cells);
          that.updateOptions();
      };
        that.clearAllOptionStyles = function(){
          for(var y = 0; y < 8; y++){     
            for(var x = 0; x < 8; x++){
              CHESSAPP.ui.clearOptionStyles(that.cells[x][y]);
            }
          }
        };
        that.updateOptions = function(){
          var response = CHESSAPP.Analyzer.makeAllOptions({pieces: that.pieces}),
              currentColor = _settings.turn, //check all of the options of the other player, if they have none, they could be in stalemate
              stalemate = currentColor, //originally true, but set to false as soon as options found
              check = false,
              checkmate = false; //in reality, just stalemate and check together

          options = response.allOptions;
          //console.log("Options recieved: ");
          //console.log(options);
          
          for(var i = 0; i < options.length; i++){
            //check if corresponding piece is this color
            if(!that.pieces[i]){
              continue;
            }
            if(that.pieces[i].color == currentColor){
              if(options[i].length == 0){
                continue;
              }
              else{
                stalemate = false;
              }
            }
          }
          if(response.kingInCheck){
            check = response.kingInCheck;
          }
          if(stalemate && check){
            checkmate = check;
          }

          var local = (currentColor == _settings.onlineColor),
              msg = "",
              type = "fb";

          if(checkmate){
            if(local){
              msg = "You are in checkmate. Your opponent wins";
              type = "e";
            }
            else{
              msg = "Your opponent is in checkmate. You win";
              type = "s";
            }
          }
          else if(stalemate){
              msg = "You are in stalemate";
              type = "f";
          }
          else if(check){
            if(local){
              msg = "You are in check";
              type = "e";
            }
            else{
              msg = "Your opponent is in check";
              type = "s";
            }
          }
          if(check || checkmate || stalemate){
            that.statusUpdate({msg : msg, type : type});
          }
          /*console.log("Status : ");
          console.log("Check : " + check);
          console.log("Stalemate : " + stalemate);
          console.log("Checkmate : " + checkmate);*/
        
        }
        that.movePieceTo = function(stg){

          var piece = stg.piece,
              x = stg.x,
              y = stg.y,
              cell = that.cells[x][y],
              pieceAtLocation = CHESSAPP.Analyzer.pieceExists({pieces: that.pieces, x:x, y:y}),
              callback = stg.callback,
              moveData =  {
                            pieceType: piece.pieceType,
                            fromX: piece.x,
                            toX: x,
                            toY: y
                          };//data to be sent to update movelist function

          if(_settings.locked == true){
            //all moving is locked
            return false;
          }
          if(!that.isOption(piece, cell)){
            //this is not a valid option
            return false;
          }
          

          if(stg.local){
             //check if this is a promotion
            if(piece.pieceType == "pawn" && (y == 0 || y == 7)){
              var cb = function(){
                stg.promotion = true;
                that.movePieceTo(stg);
              };
              //show the promotion selection, and wait until user selects a piece,
              //then call the movePieceTo method again with the newly promoted selection
              that.showPromotion({piece: piece, callback : cb});
              return;
            }
          }

          //check if there is a piece of the opposing color occupying this space
          if(pieceAtLocation != null){           
            if(pieceAtLocation.color != piece.color)
            {
              moveData.killed = true;
              //remove this piece (it was taken)
              that.killPiece(pieceAtLocation);         
            }
            else{
              //you can't move on the same space as another piece of that color
              console.log("Invalid move cannot move on another piece of same color");
              return;
            }
          }

          if(stg.local){
            //send move to remote player
            var params = {pieceX: piece.x, pieceY: piece.y, newX: x, newY: y};
            if(stg.promotion){//user just promoted this piece
              params.promotion = piece.pieceType;
            }
            that.sendMove(params);
          }

          if(stg.promotion){
            moveData.promotion = stg.promotion;
          }

          piece.y = y;
          piece.x = x;
          piece.hasMoved = true;
          that.switchTurn(); //switch the turn
          that.addToMoveList(moveData);//add the move to the move list
          that.clearAllOptionStyles();//clear all of the option styles
          selectedPieceIndex = -1;
          CHESSAPP.ui.addPiece(piece, cell);
          that.updateOptions();//update all of the options here

        }; 
        that.killPiece = function(piece){
          that.removePieceFromDom(piece);
          that.removePieceFromList(piece);
        }
        that.removePieceFromDom = function(piece){
          
          var parent = piece.reference.parentNode;
          if(parent != null){
            //remove from existing position
            parent.removeChild(piece.reference);
          }
        };

        that.removePieceFromList = function(piece){
          that.pieces[that.pieces.indexOf(piece)] = null;//don't delete because we need it to be blank so it matches options array
        };
        that.showPromotion = function(stg){
          _settings.locked = true;
          stg.val = true;
          CHESSAPP.ui.setSelectionVisible(stg);
        },
        that.promote = function(stg){
          var type = stg.pieceType,
              pieceGettingPromoted = stg.piece;
          if(pieceGettingPromoted){
            var local = pieceGettingPromoted.color == _settings.onlineColor;
            if(local || !_settings.online){
              that.statusUpdate({msg: "You have promoted", type: "s"});
            }
            else{
              that.statusUpdate({msg: "Your opponent has been promoted", type: "e"});
            }
            pieceGettingPromoted.pieceType = type;//change pawn to new type
            CHESSAPP.ui.updatePiece(pieceGettingPromoted); //update piece image
            CHESSAPP.ui.setSelectionVisible({val: false});//hide selection
            _settings.locked = false;//unlock moving
            if(stg.callback){
              stg.callback();//this calls the movePieceTo method again with the original data
            }       
          }
        };
        //gets a move made from the opposing player online
        //makes it locally to match
        that.onlineMove = function(data){
          console.log(data);
          //get the piece that moved
          var pieceMoved = CHESSAPP.Analyzer.pieceExists({pieces: that.pieces, x: data.pieceX, y: data.pieceY});
          if(pieceMoved){
            if(data.promotion){
              that.promote({piece: pieceMoved, pieceType: data.promotion});
            }
            that.movePieceTo({piece: pieceMoved, x: data.newX, y: data.newY, promotion: data.promotion});
          }
        }

        that.chatMessage = function(stg){
          if(!stg.msg){
            return;//no message
          }          
          if(stg.local){
            //add the color of the local player
            stg.color = _settings.onlineColor;
            //send to other player
            CHESSAPP.onlinePlay.sendChat(stg);
          }
          CHESSAPP.ui.addChatMessage(stg);
        }
        return that;
     })();

     /* helper class for status scrolling
      stg is expected to have 
      elem - element of container holding window
      maxLines - the number of lines shown at any time in the element
    */
    var statusScroller = function(stg){
      if(this == window){
        //enforce new
        return new statusScroller(stg);
      }
      var lineHeight = 0,
          offset = 0,
          maxLines = stg.maxLines,
          totalLines = 0,
          containerElem = stg.elem,
          windowElem = document.createElement("div");

        windowElem.style.position = "relative";
        containerElem.appendChild(windowElem);

        this.updateClasses = function(){
          return;
          CHESSAPP.utils.removeClass(containerElem, "upDisabled");
          CHESSAPP.utils.removeClass(containerElem, "downDisabled");
          if(totalLines < maxLines){
            CHESSAPP.utils.addClass(containerElem, "upDisabled");
            CHESSAPP.utils.addClass(containerElem, "downDisabled");
          }
          else if(offset == (maxLines - totalLines) - 1){
            CHESSAPP.utils.addClass(containerElem, "downDisabled");
          }
          else if(offset == 0){
            CHESSAPP.utils.addClass(containerElem, "upDisabled");
          }
        }
        this.move = function(up){
          if(stg.scroll){return;}//this is only for non scrolling
          if(totalLines <= maxLines){
            return;
          }
          if(up){
            if(offset >= 0){
              return;
            }
            else{
              offset++;
            }             
          }
          else{
            if(offset <= (maxLines - totalLines) - 1){
              return;
            }
            else{
              offset--;
            }
          }
          windowElem.style.top = (offset * lineHeight) + "px";
          this.updateClasses();
        };
        this.goToBottom = function(){
          if(stg.scroll){
            containerElem.scrollTop = containerElem.scrollHeight;
          }
          else{
            if(totalLines > maxLines){
              offset = (maxLines - totalLines);
              windowElem.style.top = (offset * lineHeight) + "px";
            }
          }
          this.updateClasses();
        };
        this.add = function(stg){
          var def = {
                msg : "",
                type : "fb", //fb - feedback, e - error, s - success, W - white, B - black (chat messgae)
                showTime: false
              },
              textNode,
              textNode2,
              p = document.createElement("p"),       
              time = new Date(),//get the current time
              timetext = time.toLocaleTimeString(),
              timeEl = document.createElement("time");

          CHESSAPP.utils.extend(def, stg);

          if(def.msg == null){
            return false;
          }


          //show feedback
          textNode = document.createTextNode(timetext);
          timeEl.appendChild(textNode);
          p.appendChild(timeEl);

          textNode2 = document.createTextNode(stg.msg);      
          p.appendChild(textNode2);
          p.setAttribute("class", def.type);
          windowElem.appendChild(p);
          
          //set the position to hide messages that are two lines old
          totalLines++;
          lineHeight = p.offsetHeight;
          this.goToBottom();
        }
    };


     CHESSAPP.ui = {
      chessboard: null, //element where chessboard is :P
      selection : null, //element where promotion selection box is
      overlay: null, //overlay element
      status : null,//element where status updates are shown
      statusWindow : null,//inner area in status where text actually is
      lineSize: 0,//size of each paragraph line (for scrolling in status)
      promotion_data : null,//stores the piece to be promoted, and the callback while the user is choosing a piece
      chatWindow : null,
      chatInput: null,
      elementsCreated : false,//tells whether the necessary elements are in place (at first no, but created in init)
      init : function(stg){
        this.container = stg.container;
	if(!this.elementsCreated){
		//create the UI here... ugh
		this.createStatus();
        	this.createOverlay();
		this.createSelection();
		if(stg.online){
	          this.createChat();
       		 }
	}
        return this.drawCells(); //not sure what to do about this right now
      },
      //UI creation methods follow
        createChat: function(chatID){
          this.chatContainer = document.createElement("div");
          this.chatContainer.className = "chat";
          this.chatInput = document.createElement("input");
          this.chatWindow = document.createElement("div");
          this.chatWindow.className = "chatContainer";
          
          var cw = this.chatWindow,
              ci = this.chatInput,
              def = "type something and press enter";

          ci.value = def;   
          //remove the default text in the textbox when a user focuses       
          CHESSAPP.utils.bind(ci, "focus", function(e){
            if(ci.value == def){
              ci.value = "";
            }
          });
          //add it back if there is nothing in the textbox
          CHESSAPP.utils.bind(ci, "blur", function(e){
            if(ci.value == ""){
              ci.value = def;
            }
          });
          CHESSAPP.utils.bind(ci, "keypress", function(e){
            var key=(e.charCode)?e.charCode:((e.keyCode)?e.keyCode:((e.which)?e.which:0));
            if(key=="13"){
              CHESSAPP.GamePlay.chatMessage({msg : ci.value, local : true});
              ci.value = "";
            }
          });


          var header = document.createElement("h2");
          header.appendChild(document.createTextNode("chat"));

          this.chatContainer.appendChild(header);
          this.chatContainer.appendChild(cw);
          this.chatContainer.appendChild(ci);

          this.container.appendChild(this.chatContainer);
        },

     createOverlay : function(){
        var overlay = document.createElement("div");
            overlay.className = "overlay";
        this.container.appendChild(overlay);
        this.overlay = overlay;
      },
     createSelection : function(selectionID){
          var selection = document.createElement("div"),
              inner = document.createElement("div"),
              frag = document.createDocumentFragment(),
              a = document.createElement("a"),
              a2 = document.createElement("a"),
              a3 = document.createElement("a"),
              a4 = document.createElement("a");

          selection.className = "selection";  

          a.setAttribute("data-pieceType", "knight"); 
          a.appendChild(document.createTextNode("Knight"));       
          a2.setAttribute("data-pieceType", "bishop");    
          a2.appendChild(document.createTextNode("Bishop"));    
          a3.setAttribute("data-pieceType", "rook");
          a3.appendChild(document.createTextNode("Rook")); 
          a4.setAttribute("data-pieceType", "queen");
          a4.appendChild(document.createTextNode("Queen")); 


          frag.appendChild(a);
          frag.appendChild(a2);
          frag.appendChild(a3);
          frag.appendChild(a4);

          inner.appendChild(frag);
          selection.appendChild(inner);

          CHESSAPP.utils.bind(selection, "click", CHESSAPP.ui.promotionClicked);
          this.container.appendChild(selection);

          this.selection = selection;
        },
        setSelectionVisible : function(stg){
          var val = stg.val;
          if(val){
            this.selection.style.display = "block";
            this.promotion_data = stg;
            this.toggleOverlay(true);
          }
          else{
            this.selection.style.display = "none";
            this.promotion_data = null;
            this.toggleOverlay(false);
          }
        },
        promotionClicked : function(e){
          e.preventDefault();
          e.stopPropagation();
          e = e || window.event;
          src = e.target || e.srcElement;
          if(src.nodeName.toLowerCase() == "a"){
            //get the piece type selected
            var val = src.getAttribute("data-pieceType");
            if(val){
              console.log("User selected " + val);
              CHESSAPP.ui.promotion_data.pieceType = val;
              CHESSAPP.GamePlay.promote(CHESSAPP.ui.promotion_data);
            }
          }
          return false;
        },


        /* creates container for status and scrolling */
        createStatus : function(statusID){
          var status = document.createElement("div"),
              arrow_up = document.createElement("a"),
              arrow_down = document.createElement("a");

          status.className = "status";       
          arrow_up.className = "arrow_up";
          arrow_down.className = "arrow_down";

          this.statusWindow = new statusScroller({elem: status, maxLines: 2});
          CHESSAPP.utils.bind(arrow_up, "click", function(e){
            CHESSAPP.ui.statusWindow.move(true);
            e.preventDefault();
            return false;
          });
          CHESSAPP.utils.bind(arrow_down, "click", function(e){
            CHESSAPP.ui.statusWindow.move(false);
            e.preventDefault();
            return false;
          });
          

          status.appendChild(arrow_up);
          status.appendChild(arrow_down);
          this.container.appendChild(status);
          this.status = status;
        },
      toggleOverlay: function(val){     
          this.overlay.style.display = val ? "block" : "none"; 
      },
      //adds cells to the elem, returns an array of the cells
      drawCells : function(){
            var chessboard = document.createElement("div"),
                frag = document.createDocumentFragment(),
                cellDiv = document.createElement("div"),
                cells = new Array(8);

            chessboard.className = "chessboard";
            /* the reason that the divs are created here is for performance, otherwise
               the divs would normally be created in the Cell class */
            
            //create multi-dimensional array
            for(var x = 0; x < 8; x++){
              cells[x] = new Array(8);
            }
            //create board and cell references
            for(var y = 0; y < 8; y++){     
              for(var x = 0; x < 8; x++){
               var clone = cellDiv.cloneNode();
               if((x % 2 == 1 && y % 2 == 1) || (x % 2 == 0 && y % 2 == 0)){
                 CHESSAPP.utils.addClass(clone, "W");
               }else{
                 CHESSAPP.utils.addClass(clone, "B");
               }
               clone.setAttribute("data-x", x);
               clone.setAttribute("data-y", y);
               //create cell object
               cells[x][y] = {
                 reference: clone,
                 x: x,
                 y: y
               };
              /* just for testing */
             /* var coords = document.createElement("p");
              coords.innerHTML = x + " , " + y;
              cells[x][y].reference.appendChild(coords);*/
               frag.appendChild(clone);
             }


            }
            chessboard.appendChild(frag);
            
            //add chessboard to container
            this.container.appendChild(chessboard);
            CHESSAPP.utils.bind(chessboard, "click", CHESSAPP.ui.boardClicked);



            this.chessboard = chessboard;
          //returns list of cells
          return cells;
        },

       	addMove : function(txt){
	      console.log("Showing move:" + txt);
      	},
        drawPieces: function(pieces, cells){
          var i=0, max=pieces.length;
          for(; i<max ; i++){
            var p = pieces[i];
            var img = new Image();
            img.src = CHESSAPP.globalSettings.imageDir + p.color + "_" + p.pieceType + ".svg";
            p.reference = img;
            cells[p.x][p.y].reference.appendChild(img);
          }
        },
        updatePiece : function(piece){
          //this is only used when a pawn is promoted, to update the image
          var p = piece;
          p.reference.src = CHESSAPP.globalSettings.imageDir + p.color + "_" + p.pieceType + ".svg";
        },
        boardClicked : function(e){
          var x,y, cellReference, pieceClicked = false;
          e = e || window.event;
          src = e.target || e.srcElement;
          if(src.nodeName.toLowerCase() == "img"){
            //it is a piece
            cellReference = src.parentNode;
          }
          else if(src.nodeName.toLowerCase() == "div"){
            //could be a cell
            cellReference = src;
          }
          if(cellReference){
            x = cellReference.getAttribute("data-x");
            y = cellReference.getAttribute("data-y");

            if(x && y){
              CHESSAPP.GamePlay.cellClicked(x,y);
              var piece = CHESSAPP.Analyzer.pieceExists({pieces: CHESSAPP.GamePlay.pieces, x:x,y:y});
              if(piece){
                CHESSAPP.GamePlay.pieceClicked(piece);
              }
            }
          }
        },
        addOptionStyles : function(cell, userSettings){
          var stg = {
            attackable: true,
            movable: true
          };        
          CHESSAPP.utils.extend(stg, userSettings);

          if(stg.attackable){
            CHESSAPP.utils.addClass(cell.reference, "attackable");
          }

          if(stg.movable){
            CHESSAPP.utils.addClass(cell.reference, "movable");
          }
        },

        clearOptionStyles : function(cell){
          CHESSAPP.utils.removeClass(cell.reference,"movable");
          CHESSAPP.utils.removeClass(cell.reference,"attackable");
        },

        addPiece : function(piece, cell){
          cell.reference.appendChild(piece.reference);
        },
        

        /*
        this updates the status element with the user specified message
        */
        statusUpdate: function(stg){
          stg.showTime = true;
          this.statusWindow.add(stg);
        },

               addChatMessage : function(stg){
          var prefix = (stg.color == 'W') ? "White - " : (stg.color == "B") ? "Black - " : "",
              p = document.createElement("p"),
              textNode = document.createTextNode(prefix + stg.msg);
          p.appendChild(textNode);
          this.chatWindow.appendChild(p);
          this.chatWindow.scrollTop = this.chatWindow.scrollHeight;

        },

    };

    CHESSAPP.onlinePlay = {
      sk : null,
      /*
      connects to websocket server, and sets up events for when a matched player is found
      */
      connect: function(stg, callback){
        var op = CHESSAPP.onlinePlay;
        this.sk = io.connect('http://localhost:8000');
        CHESSAPP.ui.statusUpdate({type: 'fb', msg: 'Searching for partner...'});
        this.sk.emit('setup', {color: stg.preferredColor});
        this.sk.on("chat", function(data){
          CHESSAPP.GamePlay.chatMessage(data);
        });
        this.sk.on("partnerDisconnect", function(){
          CHESSAPP.GamePlay.statusUpdate({type: 'e', msg: 'Your partner has disconnected'});
          //CHESSAPP.GamePlay.showSplash();
        });
        this.sk.on("disconnect", function(){
          CHESSAPP.GamePlay.statusUpdate({type: 'e', msg: 'The server seems to be down. Please refresh the page to try again. We are sorry for the inconvenience.'});
        });
        this.sk.on('matchfound', function (data) {

          CHESSAPP.GamePlay.statusUpdate({type: 'fb', msg: 'Partner found, game has begun'});
          CHESSAPP.GamePlay.statusUpdate({type: 'fb', msg : 'Playing as ' + (data.color == 'W' ? "white" : 'black')})
          CHESSAPP.GamePlay.setOnlineColor(data.color); //maybe change this to decouple
          callback();
        });
        this.sk.on('opposing_move', function(data){
          CHESSAPP.GamePlay.onlineMove(data);
        });
      },
      sendMove: function(stg){
        this.sk.emit('movemade', stg);
      },
      sendChat: function(stg){
        stg.local = false;//because the recieved message will not be local
        this.sk.emit('chat', stg);
      },
      handleMsg : function(e){
        var resp = JSON.parse(e.data);
        console.log(resp);
      }
    };


    var settings = {
      containerID : "container",
      online: true,
      preferredColor: false
    };
    CHESSAPP.GamePlay.init(settings);
