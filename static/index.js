// when page loads...
$(document).ready(function() {
	// Initialize material design things
	$('.modal').modal();
	$(".button-collapse").sideNav();

    urlq = QueryString.q;

    // display message, if any
    if (msg !== '') {
        $("#info").append($('<div>').addClass('col s12').html(msg));
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

	// Add info bar
	addInfo();

	// Scroll position remember thing
	window.onbeforeunload = function(e){
		saveScrollPosition();
	};

	retriveScrollPosition();
});
