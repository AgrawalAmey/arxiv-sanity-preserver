// when page loads...
$(document).ready(function() {
	// Initialize material design things
	$('.modal').modal();
	$(".button-collapse").sideNav();

	// Update search bar with query
    urlq = QueryString.q;
	if (typeof urlq !== 'undefined') {
		$("#qfield").attr('value', urlq.replace(/\+/g, " "));
	}

    // add papers to #rtable
    addPapers(20, false);

    // set up inifinite scrolling for adding more papers
    $(window).on('scroll', function() {
        var scrollTop = $(document).scrollTop();
        var windowHeight = $(window).height();
        var bodyHeight = $(document).height() - windowHeight;
        var scrollPercentage = (scrollTop / bodyHeight);
        if (scrollPercentage > 0.9) {
            addPapers(5);
        }
    });

	// Scroll position remember thing
	window.onbeforeunload = function(e){
		saveScrollPosition();
	};

	retriveScrollPosition();
});
