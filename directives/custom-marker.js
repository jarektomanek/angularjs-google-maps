/**
 * @ngdoc directive
 * @memberof ngmap
 * @name custom-marker
 * @param Attr2Options {service} convert html attribute to Gogole map api options
 * @param $timeout {service} AngularJS $timeout
 * @description
 *   Marker with html
 *   Requires:  map directive
 *   Restrict To:  Element
 *
 * @attr {String} position required, position on map
 * @attr {Number} z-index optional
 * @attr {Boolean} visible optional
 * @example
 *
 * Example:
 *   <map center="41.850033,-87.6500523" zoom="3">
 *     <custom-marker position="41.850033,-87.6500523">
 *       <div>
 *         <b>Home</b>
 *       </div>
 *     </custom-marker>
 *   </map>
 *
 */
/* global document */
(function() {
  'use strict';
  var parser, $timeout, $compile, NgMap;

  var CustomMarker = function(options) {
    options = options || {};

    this.el = document.createElement('div');
    this.el.style.display = 'inline-block';
    this.el.style.visibility = "hidden";
    this.visible = true;
    for (var key in options) { /* jshint ignore:line */
     this[key] = options[key];
    }
  };

  var setCustomMarker = function() {

    CustomMarker.prototype = new google.maps.OverlayView();

    CustomMarker.prototype.setContent = function(html, scope) {
      this.el.innerHTML = html;
      this.el.style.position = 'absolute';
      if (scope) {
        $compile(angular.element(this.el).contents())(scope);
      }
    };

    CustomMarker.prototype.getDraggable = function() {
      return this.draggable;
    };

    CustomMarker.prototype.setDraggable = function(draggable) {
      this.draggable = draggable;
    };

    CustomMarker.prototype.getPosition = function() {
      return this.position;
    };

    CustomMarker.prototype.setPosition = function(position) {
      position && (this.position = position); /* jshint ignore:line */

      if (this.getProjection() && typeof this.position.lng == 'function') {
        var posPixel = this.getProjection().fromLatLngToDivPixel(this.position);
        var _this = this;
        var setPosition = function() {
          var x = Math.round(posPixel.x - (_this.el.offsetWidth/2));
          var y = Math.round(posPixel.y - _this.el.offsetHeight - 10); // 10px for anchor
          _this.el.style.left = x + "px";
          _this.el.style.top = y + "px";
          _this.el.style.visibility = "visible";
        };
        if (_this.el.offsetWidth && _this.el.offsetHeight) { 
          setPosition();
        } else {
          //delayed left/top calculation when width/height are not set instantly
          $timeout(setPosition, 300);
        }
      }
    };

    CustomMarker.prototype.setZIndex = function(zIndex) {
      zIndex && (this.zIndex = zIndex); /* jshint ignore:line */
      this.el.style.zIndex = this.zIndex;
    };

    CustomMarker.prototype.setVisible = function(visible) {
      this.el.style.display = visible ? 'inline-block' : 'none';
      this.visible = visible;
    };

    CustomMarker.prototype.addClass = function(className) {
      var classNames = this.el.className.trim().split(' ');
      (classNames.indexOf(className) == -1) && classNames.push(className); /* jshint ignore:line */
      this.el.className = classNames.join(' ');
    };

    CustomMarker.prototype.removeClass = function(className) {
      var classNames = this.el.className.split(' ');
      var index = classNames.indexOf(className);
      (index > -1) && classNames.splice(index, 1); /* jshint ignore:line */
      this.el.className = classNames.join(' ');
    };

    CustomMarker.prototype.onAdd = function() {
      this.getPanes().overlayMouseTarget.appendChild(this.el);
    };

    CustomMarker.prototype.draw = function() {
      this.setPosition();
      this.setZIndex(this.zIndex);
      this.setVisible(this.visible);
    };

    CustomMarker.prototype.onRemove = function() {
      this.el.parentNode.removeChild(this.el);
      //this.el = null;
    };
  };

  var linkFunc = function(orgHtml, varsToWatch) {
    //console.log('orgHtml', orgHtml, 'varsToWatch', varsToWatch);

    return function(scope, element, attrs, mapController) {
      mapController = mapController[0]||mapController[1];
      var orgAttrs = parser.orgAttributes(element);

      var filtered = parser.filter(attrs);
      var options = parser.getOptions(filtered, {scope: scope});
      var events = parser.getEvents(scope, filtered);

      /**
       * build a custom marker element
       */
      element[0].style.display = 'none';
      console.log("custom-marker options", options);
      var customMarker = new CustomMarker(options);

      
	  scope.$watch('[' + varsToWatch.join(',') + ']', function() {
	    customMarker.setContent(orgHtml, scope);
	  });

	  customMarker.setContent(element[0].innerHTML, scope);
	  var classNames = element[0].firstElementChild.className;
	  customMarker.addClass('custom-marker');
	  customMarker.addClass(classNames);
	  console.log('customMarker', customMarker, 'classNames', classNames);

	  if (!(options.position instanceof google.maps.LatLng)) {
	    NgMap.getGeoLocation(options.position).then(
		  function(latlng) {
		    customMarker.setPosition(latlng);
		  }
	    );
	  }

      console.log("custom-marker events", "events");
      for (var eventName in events) { /* jshint ignore:line */
        google.maps.event.addDomListener(
          customMarker.el, eventName, events[eventName]);
      }
      mapController.addObject('customMarkers', customMarker);

      //set observers
      mapController.observeAttrSetObj(orgAttrs, attrs, customMarker);

      element.bind('$destroy', function() {
        //Is it required to remove event listeners when DOM is removed?
        mapController.deleteObject('customMarkers', customMarker);
      });

    }; // linkFunc
  };


  var customMarkerDirective = function(
      _$timeout_, _$compile_, Attr2MapOptions, _NgMap_
    )  {
    parser = Attr2MapOptions;
    $timeout = _$timeout_;
    $compile = _$compile_;
    NgMap = _NgMap_;

    return {
      restrict: 'E',
      require: ['?^map','?^ngMap'],
      compile: function(element) {
        setCustomMarker();
        element[0].style.display ='none';
        var orgHtml = element.html();
        var matches = orgHtml.match(/{{([^}]+)}}/g);
        var varsToWatch = [];
        //filter out that contains '::', 'this.'
        (matches || []).forEach(function(match) {
          var toWatch = match.replace('{{','').replace('}}','');
          if (match.indexOf('::') == -1 &&
            match.indexOf('this.') == -1 &&
            varsToWatch.indexOf(toWatch) == -1) {
            varsToWatch.push(match.replace('{{','').replace('}}',''));
          }
        });

        return linkFunc(orgHtml, varsToWatch);
      }
    }; // return
  };// function
  customMarkerDirective.$inject =
    ['$timeout', '$compile', 'Attr2MapOptions', 'NgMap'];

  angular.module('ngMap').directive('customMarker', customMarkerDirective);
})();
