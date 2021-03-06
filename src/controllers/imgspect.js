// imgspect/:urn

appControllers.controller( 'imgspect', [
'$scope',
'$injector',
'$routeParams',
'json',
'item',
'onto',
'tmpl',
'cropper',
function( $scope, $injector, $routeParams, json, item, onto, tmpl, cropper ){
  
  // SELECTORS
  
  var img = $('.imgspect img')
  
  // Canvas
  
  var frame = $( '.imgspect.frame' );
  var canvas = $( '.imgspect.frame .canvas' );
  
  // Nav
  
  var nav = $( '.imgspect.nav' );
  var drag = $( '.imgspect.nav .drag' );
  
  // Hi-Lite

  var resize = $( '.imgspect.frame .canvas .lite.temp .resize' );
  var add = $( '.imgspect.frame .canvas .lite.temp .add' );
  var cancel = $( '.imgspect.frame .canvas .lite.temp .cancel' );
  var nudge = $( '.imgspect.frame .canvas .lite.temp .nudge' );
	var popup = $( '.imgspect.frame .canvas .annot' );

  
  // CONFIGURATION
  
  // Current URN
  
  $scope.urn = ( $routeParams.urn == undefined ) ? null : $routeParams.urn;
  
  // Stores all the JSON data
  
  $scope.json = {};
  
  // Annotation popout
  
  var popout = false;
  $scope.popout = function( bool ){
    popout = ( bool == undefined ) ? popout : bool;
    return popout
  }
  
  // Application state

  $scope.config = {
		zoom: {
			max: 5
		},
    lite: {
      color:'#FF0',
      opa:0.75
    },
    nav: {
      opa:0.5,
			pos:'right'
    },
    annot: {
      color: '#F2F2F2',
      opa:0.9,
      input: {
        color: '#FDFDFD'
      }
    },
		color_picker: {
  		show: null,
  		showSpeed: 100
		}
  };  
  var orig = {};
	
	$scope.lite_opa_chg = function(n){
		$scope.config.lite.opa = n;
		$scope.$apply();
	}

  // Frame Size
  
  $scope.frame_w = function(){
    return frame.width();
  };
  $scope.frame_h = 600;
  
  // Canvas size and position

  $scope.canvas_w = 0;
  $scope.canvas_h = 0;
  $scope.canvas_x = 0;
  $scope.canvas_y = 0;
  $scope.zoom = 1;
	
	// Change zoom
	
	$scope.zoom_chg = function(n){
		var max = $scope.config.zoom.max;
		var zoom = n * max;
		$scope.zoom = zoom.toPrecision(2);
		dragging()
	}
	
	// Calculate popup offset
	
	$scope.calc_offset = function( dim ){
		var x = $scope.frame_x_rel( parseFloat( $scope.temp_lite.x ) + parseFloat( $scope.temp_lite.w * 0.5 ) );
		var y = $scope.frame_y_rel( parseFloat( $scope.temp_lite.y ) + parseFloat( $scope.temp_lite.h ) );
		switch( dim ){
			case 'x':
				if ( x > 0.75 ){
					return popup.outerWidth()*-1;
				}
				return 0;
				break;
			case 'y':
				if ( x > 0.75 ){
					return 0;
				}
				if ( y < 0.75 ){
					return $scope.to_canvas_y( $scope.temp_lite.h )
				}
				return popup.outerHeight()*-1;
				break;
		}
	}
  
  
  // Ratios
  
  $scope.wr = function(){
    var wr = $scope.frame_w() / $scope.canvas_w;
    wr = ( wr > 1 ) ? 1 : wr;
    return wr;
  }
  
  $scope.hr = function(){
    var hr = $scope.frame_h / $scope.canvas_h;
    hr = ( hr > 1 ) ? 1 : hr;
    return hr;
  }
  
  // Dragger Position
  
  $scope.drag_x = 0;
  $scope.drag_y = 0;
  $scope.drag_w = function(){
    return $scope.nav_w() * $scope.wr();
  }
  $scope.drag_h = function(){
    return $scope.nav_h * $scope.hr();
  }
  
  // Navigation Size
  
  $scope.nav_h = 300;
  $scope.nav_w = function(){
    return $scope.nav_scale() * orig.width
  }
  $scope.nav_scale = function(){
    return $scope.nav_h / orig.height
  }
	$scope.nav_right = true;
  
  
  // Get default annotation data
  
  $scope.default = null;
  tmpl.get( 'roi' ).then(
    function( data ){
      $scope.default = data;
    },
    function( err ){
      console.log( 'error' );
    }
  )
  
  
  
  // SERVER COMMUNICATION
  
  // Add the current temp-lite to annotations
  
  $scope.add = function(){
    var fresh = {
      'label': $scope.temp_label,
      'description': $scope.temp_desc,
      'height': $scope.temp_lite.h,
      'width': $scope.temp_lite.w,
      'x': $scope.temp_lite.x,
      'y': $scope.temp_lite.y
    };
    var annots = annotations();
    annots.push( fresh );
		$scope.popout( false );
		$scope.lite_reset();
  }
  
  // Save new annotations to database
  
  $scope.save = function(){
    var annots = annotations();
    for ( var i=0; i<annots.length; i++ ){
      
      // any annotation without a URN gets its data POSTED
      
      if ( ! ( 'urn' in annots[i] ) ){
        save_annotation( annots[i] );
      }
    }
  }
  
  function annotation_urn( annot ){
    return $scope.urn+"@"+[  
      annot['x'], 
      annot['y'],
      annot['width'],
			annot['height']
    ].join(',')
  }
  
  function save_annotation( annot ){
    
    // save into default template
    
    var def = angular.copy( $scope.default );
    annot = angular.extend( def, annot );
    annot['@id'] = annotation_urn( annot );
    annot['cite:belongsTo'] = { "@id": $scope.urn };
		annot['rdf:label'] = annot['label'];
		annot['rdf:description'] = annot['description'];
    
    // save on the server
    
    json.post( 'roi/'+annot['@id'], annot ).then( 
      function( data ){
        console.log( data );
      },
      function( err ){
        console.log( err );
      }
    )
		
		// kick off imgup crop job
		
		cropper.add( annot['@id'] );
  }
  
  function annotations(){
    return $scope.json.annotations;
  }
  
  // Get the item JSON
  
  json.urn( $scope.urn ).then( function( data ){
    var src = data.src[0];
    var srckey = onto.pre('src');
    json.get( src ).then( function( data ){
      $scope.json.item = data;
      upload_json( data[srckey]['@id'] );
    });
  });
  
  
  // get the upload JSON
  
  function upload_json( urn ){
    json.urn( urn ).then( function( data ){
      var src = data.src[0];
      json.get( src ).then( function( data ){
        $scope.json.upload = data;
        get_annotations( $scope.urn );
      });
    });
  }
  
  
  // get the annotations
  
  function get_annotations( urn ){
    item.rois( urn ).then( function( data ){
      $scope.json.annotations = data;
    });
    ready();
  }
  
  
  // Start the party once everything is loaded
  
  function ready(){
    $scope.src = $scope.json.upload['dct:references']['@id'];
    start();
  }
  
  
  
  // USER INTERACTION
    
  // Once the image loads get started
    
  function start(){
    img.load( function(){
      
      // Stash image dimensions
      
      orig.width = this.width;
      orig.height = this.height;
      
      // Start event listeners
      
      event_start();
      
      // Image you are no longer needed!
      
      img.detach();
      
      // Initial display
      
      dragging();
    });
  }
  
  // Convert relative coordinates
  
  $scope.to_canvas_x = function( n ){ return n*$scope.canvas_w }
  $scope.to_canvas_y = function( n ){ return n*$scope.canvas_h }
  
  $scope.to_nav_x = function( n ){ return n*$scope.nav_w() }
  $scope.to_nav_y = function( n ){ return n*$scope.nav_h }
  
	$scope.frame_x_rel = function( n ){ 
		var cx = $scope.to_canvas_x( n );
		return ( cx - $scope.canvas_x ) / $scope.frame_w();
	}
	
	$scope.frame_y_rel = function( n ){
		var cy = $scope.to_canvas_y( n );
		return ( cy + $scope.canvas_y ) / $scope.frame_h;
		
	}
  
  
  // LITE
  
  // Start the hi-liter
  
  var pressed = false;
  $( document )
  .on( 'touchstart mousedown', function(){
    pressed = true;
  })
  .on( 'touchend mouseup', function(){
    pressed = false;
  });
  
  function event_match( e ){
    return ( e.originalEvent.srcElement == canvas[0] ) ? true : false
  }
  
  // The temp_lite object
  
  function clear_pos(){ return { x:null, y:null, w:null, h:null } };
  $scope.temp_lite = clear_pos();
  
  $scope.lite_reset = function(){
    $scope.temp_lite = clear_pos();
  }
  
  $scope.lite_cancel = function(){ 
    $scope.lite_reset();
    $scope.refresh();
  }
  
  $scope.lite_clear_text = function(){
    $scope.temp_label = '';
    $scope.temp_desc = '';
  }
  $scope.lite_clear_text();
  
  // Stash the lite
  
  $scope.lites = [];
  $scope.lite_stash = function(){
    $scope.lites.push( angular.copy( $scope.temp_lite ) );
  }
  
  // The temp_lite points
  
  var _p1 = { x:null, y:null };
  var p1 = function( pos ){
    if ( ! angular.isDefined( pos ) ){
      return _p1
    }
    _p1.x = pos.x;
    _p1.y = pos.y;
  }
  
  var _p2 = { x:null, y:null };
  var p2 = function( pos ){
    if ( ! angular.isDefined( pos ) ){
      return _p2
    }
    _p2.x = pos.x;
    _p2.y = pos.y;
  }
  
  // Set p1 to upper-left and p2 to lower-right
  
  function point_clean(){
    p1({ x:min_x(), y:min_y() });
    p2({ x:max_x(), y:max_y() });
  }
  
  function min_x(){ return Math.min( p1().x, p2().x ) }
  function min_y(){ return Math.min( p1().y, p2().y ) }
  function max_x(){ return Math.max( p1().x, p2().x ) }
  function max_y(){ return Math.max( p1().y, p2().y ) }
  
  function ctrl_start(){
    add.on('touchstart click', function(e){
      $scope.lite_stash();
    });
    cancel.on('touchstart click', function(e){
      $scope.lite_cancel();
    });
  }
  
  function point_diff( p1, p2 ){
    return { x:p1.x-p2.x, y:p1.y-p2.y }
  }
  
  function point_add( p1, p2 ){
    return { x:p1.x+p2.x, y:p1.y+p2.y }
  }
  
  var nudge_clear = function(){ return { x:null, y:null } }
  var nudge_diff = nudge_clear();
  function nudge_start(){
    nudge
    .on('touchstart mousedown', function(e){
      nudge_diff = point_diff( mouse_rel( e ), p1() );
    })
    .on('touchend mouseup', function(e){
      nudge_diff = nudge_clear();
    });
    
    // See lite_move()
  }
  
  function nudge_check(){
    if ( nudge_diff.x == null && nudge_diff.y == null ){
      return false;
    }
    return true;
  }
  
  function resize_start(){
    resize
    .on('touchstart mousedown', function(e){
      console.log( 'resize down' );
    })
    .on('touchmove mousemove', function(e){
      console.log( 'resize move' );
    })
    .on('touchend mouseup', function(e){
      console.log( 'resize up' );
    });
  }
  
  function lite_start(){
    canvas
    .on('touchstart mousedown', function(e){
      ( event_match(e) ) ? lite_down( e ) : null;
    })
    .on('touchmove mousemove', function(e){
      lite_move( e );
    })
    .on('touchend mouseup', function(e){
      lite_up( e );
    });
  }
  
  function event_start(){
    drag_start();
    lite_start();
    nudge_start();
    // resize_start();
    ctrl_start();
  }
  
  function lite_pos( e ){
    p2( mouse_rel( e ) );
    lite_size();
  }
  
  function lite_size(){
    $scope.temp_lite.x = min_x().toFixed(4);
    $scope.temp_lite.y = min_y().toFixed(4);
    $scope.temp_lite.w = (max_x()-$scope.temp_lite.x).toFixed(4);
    $scope.temp_lite.h = (max_y()-$scope.temp_lite.y).toFixed(4);
  }
  
  function nudge_pos( e ){
    var pos = mouse_rel( e )
    var size = point_diff( p2(), p1() );
    p1( point_diff( pos, nudge_diff ) );
    p2( point_add( p1(), size ) );
    lite_size();
  }
  
  function lite_down( e ){
    p1( mouse_rel( e ) );
  }
  
  function lite_move( e ){
    if ( pressed ) {
      
      // Are you nudging the temp-lite?
      
      if ( nudge_check() ) {
        nudge_pos( e );
      }
      
      // No you're drawing it.
      
      else {
        lite_pos( e );
      }
      
      // update styles
      
      $scope.refresh();
    }
  }
  
  function lite_up( e ){
    point_clean();
  }
  
  function mouse_rel( e ){
    var pos = canvas.offset();
    var x = (e.clientX - pos.left);
    var y = (e.clientY - pos.top + $(document).scrollTop() );
    return { 'x':x/$scope.canvas_w, 'y':y/$scope.canvas_h }
  }
  
  
  // DRAGGER
  
  // Start the dragger
  
  function drag_start(){
    drag.draggable({
      containment:'parent',
      scroll:false,
      drag:function(){ dragging() },
      stop:function(){}
    });
  }
  
  // Move the canvas
  
  function canvas_move(){
    var pos = drag.position();
    var x =  pos.left/$scope.nav_scale();
    var y =  pos.top/$scope.nav_scale();
    $scope.canvas_x = x*-1*$scope.zoom;
    $scope.canvas_y = y*-1*$scope.zoom;
    $scope.refresh();
  }
  
  // What happens when dragger is moved
  
  function dragging(){
    $scope.canvas_w = orig.width*$scope.zoom;
    $scope.canvas_h = orig.height*$scope.zoom;
    canvas_move();
  }
  
  
  $scope.refresh = function(){
    $scope.$digest();
  }
  
}]);