// This file handles instructing the Dojo Builder in 1.8 on what it can ignore trying to optimize.
// This is mainly to keep it from trying to AMD-Wrap .js test files in xwt/widget/tests that define
// a bunch of global functions.

var profile = (function(){
	var testResourceRe = /.*\/tests\//;
	var cssResourceRe = /^xmp\/.*\/css\//;
	var dataResourceRe =  /.*\/data\//;
	var copyOnly = function(filename, mid){
			return cssResourceRe.test(mid) || 
				testResourceRe.test(mid) || 
				dataResourceRe.test(mid) ||
				/(png|jpg|jpeg|gif|tiff|json)$/.test(filename);
		};
	return {
		resourceTags:{
			test: function(filename, mid){
				return testResourceRe.test(mid);
			},
			copyOnly: function(filename, mid){
				// Don't mess with html2canvas
				return true;
			},
			amd: function(filename, mid){
				// Nothing in XWT is really AMD at this point, so tell it otheriwse.
				return false;
			}
		}
	};
})();
