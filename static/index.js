// when page loads...
$(document).ready(function() {
	// Initialize material design things
	$('.modal').modal();
	$(".button-collapse").sideNav();

	// Setup note editor form
	$("#note-submit").on('click', function() {
	    id = $("#note_id").val();
	    note = $("#raw_text").val();
		type = $('#note_type').val();
	    if (username !== '') {
	        // issue the post request to the server
	        $.post("/editnote", {
	            pid: pid,
	            note: text
	        })
	        .done(function(data) {
	            // toggle state of the image to reflect the state of the server, as reported by response
	            $("#note" + id).html(marked(note));
	            $("#note_state" + id).html('Edit note');
				$('#md').modal('close');
	        });
	    } else {
	        alert('you must be logged in to edit notes.');
	    }
	});

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
