var urlq = '';

// helper function so that we can access keys in url bar
var QueryString = function() {
    // This function is anonymous, is executed immediately and
    // the return value is assigned to QueryString!
    var query_string = {};
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
            // If second entry with this name
        } else if (typeof query_string[pair[0]] === "string") {
            var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
            query_string[pair[0]] = arr;
            // If third or later entry with this name
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }
    return query_string;
}();

// for dealing with ids that have . in them
function jq(myid) {
    return myid.replace(/(:|\.|\[|\]|,)/g, "\\$1");
}

function build_ocoins_str(p) {
    var ocoins_info = {
        "ctx_ver": "Z39.88-2004",
        "rft_val_fmt": "info:ofi/fmt:kev:mtx:journal",
        "rfr_id": "info:sid/arxiv-sanity.com:arxiv-sanity",

        "rft_id": p.link,
        "rft.atitle": p.title,
        "rft.jtitle": "arXiv:" + p.pid + " [" + p.category.substring(0, p.category.indexOf('.')) + "]",
        "rft.date": p.published_time,
        "rft.artnum": p.pid,
        "rft.genre": "preprint",

        // NB: Stolen from Dublin Core; Zotero understands this even though it's
        // not part of COinS
        "rft.description": p.abstract,
    };
    ocoins_info = $.param(ocoins_info);
    ocoins_info += "&" + $.map(p.authors, function(a) {
        return "rft.au=" + encodeURIComponent(a);
    }).join("&");

    return ocoins_info;
}

function build_authors_html(authors) {
    var res = '';
    for (var i = 0, n = authors.length; i < n; i++) {
        var link = '/search?q=' + authors[i].replace(/ /g, "+");
        res += '<a href="' + link + '">' + authors[i] + '</a>';
        if (i < n - 1) res += ', ';
    }
    return res;
}

function build_categories_html(tags) {
    var res = '';
    for (var i = 0, n = tags.length; i < n; i++) {
        var link = '/search?q=' + tags[i].replace(/ /g, "+");
        res += '<a href="' + link + '">' + tags[i] + '</a>';
        if (i < n - 1) res += ' | ';
    }
    return res;
}

// here we populate papers into #rtable
var pointer_ix = 0; // points to next paper in line to be added to #rtable
var showed_end_msg = false;

function addPapers(num, dynamic) {
    if (papers.length === 0) {
        return;
    } // nothing to display

    var root = $("#end");

    var base_ix = pointer_ix;
    var msg = '';
    for (var i = 0; i < num; i++) {
        var ix = base_ix + i;
        if (ix >= papers.length) {
            if (!showed_end_msg) {
                if (ix >= numresults) {
                    msg = 'Results complete.';
                } else {
                    msg = 'You hit the limit of number of papers to show in one result.';
                }
                root.append($('<div>').addClass('card white col s12').html(msg));
                showed_end_msg = true;
            }
            break;
        }
        pointer_ix++;

        root = $("#rtable");
        var p = papers[ix];
		var div = $('<div>').addClass('card').attr('id', p.pid);
		root.append(div);
        // Generate OpenURL COinS metadata element -- readable by Zotero, Mendeley, etc.
        var ocoins_span = div.append($('<span>').addClass('Z3988').attr('title', build_ocoins_str(p)));

        var tdiv = $('<div>').addClass('card-title row');
		div.append(tdiv);

        var tldiv = $('<div>').addClass('col s8');
		tdiv.append(tldiv);

        tldiv.append($('<span>').addClass('ts').append($('<a>').attr('href', p.link).attr('target', '_blank').html(p.title)));
        tldiv.append($('<br>'));
        tldiv.append($('<span>').addClass('as').html(build_authors_html(p.authors)));
        tldiv.append($('<br>'));
        tldiv.append($('<span>').addClass('ds').html(p.published_time));
        if (p.originally_pubslished_time !== p.published_time) {
            tldiv.append($('<span>').addClass('ds2').html('(v1: ' + p.originally_published_time + ')'));
        }
        tldiv.append($('<span>').addClass('cs').html(build_categories_html(p.tags)));
        tldiv.append($('<br>'));
        tldiv.append($('<span>').addClass('ccs').html(p.comment));

        var trdiv =$('<div>').addClass('col s4 right-align');
		tdiv.append(trdiv);
        // Paper id
        trdiv.append($('<span>').addClass('spid').html(p.pid));
        trdiv.append($('<br>'));
        // access PDF of the paper
        // convert from /abs/ link to /pdf/ link. url hacking. slightly naughty
        var pdf_link = p.link.replace("abs", "pdf");
        // replace failed, lets fall back on arxiv landing page
        if (pdf_link === p.link) {
            pdf_url = pdf_link;
        } else {
            pdf_url = pdf_link + '.pdf';
        }
        trdiv.append($('<a>').attr('href', pdf_url).attr('target', '_blank').html('pdf'));


        if (typeof p.img !== 'undefined') {
            div.append($('<div>').addClass('paper-image center-align').append($('<img>').attr('src', p.img)));
        }

        if (typeof p.abstract !== 'undefined') {
            var abdiv = $('<div>').addClass('card-content').append($('<p>').html(p.abstract));
			div.append(abdiv);
            if (dynamic) {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, abdiv]); //typeset the added paper
            }
        }


        // action items for each paper
        var adiv = $('<div>').addClass('card-action');
		div.append(adiv);

        var lib_state = p.in_library === 1 ? 'Saved' : 'Save';
        var saveimg = $('<a>').attr('href', '#').attr('id', 'lib' + p.pid).html(lib_state);
		adiv.append(saveimg);

        // attach a handler for in-library toggle
        saveimg.on('click', function(pid, elt) {
            return function() {
                if (username !== '') {
                    // issue the post request to the server
                    $.post("/libtoggle", {
                            pid: pid
                        })
                        .done(function(data) {
                            // toggle state of the image to reflect the state of the server, as reported by response
                            if (data === 'ON') {
                                elt.html('Saved');
                            } else if (data === 'OFF') {
                                elt.html('Save');
                            }
                        });
                } else {
                    alert('you must be logged in to save papers to library.');
                }
            };
        }(p.pid, saveimg)); // close over the pid and handle to the image

        // rank by tfidf similarity
        adiv.append($('<a>').attr('id', 'sim' + p.pid).attr('href', '/' + p.pid).attr('target', '_blank').html('Show similar'));

        adiv.append($('<a>').attr('target', '_blank').attr('href', 'http://www.shortscience.org/paper?bibtexKey=' + p.pid).html('review'));

        if (render_format == 'paper' && ix === 0) {
            // lets insert a divider/message
            root.append($('<div>').addClass('card paperdivider').html('Most similar papers:'));
        }
    }
}

// when page loads...
$(document).ready(function() {

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

    if (typeof urlq !== 'undefined') {
        $("#qfield").attr('value', urlq.replace(/\+/g, " "));
    }

    var vf = QueryString.vfilter;
    if (typeof vf === 'undefined') {
        vf = 'all';
    }
    var tf = QueryString.timefilter;
    if (typeof tf === 'undefined') {
        tf = 'week';
    }
    var link_endpoint = '/';
    if (render_format === 'recent') {
        link_endpoint = '';
    }
    if (render_format === 'top') {
        link_endpoint = 'top';
    }
    if (render_format === 'recommend') {
        link_endpoint = 'recommend';
    }

    var time_ranges = ['day', '3days', 'week', 'month', 'year', 'alltime'];
    var time_txt = {
        'day': 'Last day',
        '3days': 'Last 3 days',
        'week': 'Last week',
        'month': 'Last month',
        'year': 'Last year',
        'alltime': 'All time'
    };
    var time_range = tf;

    var elt = $('#recommend-time-choice');
    // set up time filtering options
    if (render_format === 'recommend' || render_format === 'top' || render_format === 'recent') {
        // insert version filtering options for these views
        var vflink = vf === 'all' ? '1' : 'all'; // toggle only showing v1 or not
        if (render_format === 'recent') {
            var aelt = $('<a>').attr('href', '/' + link_endpoint + '?' + '&vfilter=' + vflink); // leave out timefilter from this page
			elt.append(aelt);
		} else {
            var aelt = $('<a>').attr('href', '/' + link_endpoint + '?' + 'timefilter=' + time_range + '&vfilter=' + vflink);
			elt.append(aelt);
		}
        var delt = $('<div>').addClass('vchoice').html('Only show v1');
		aelt.append(delt);
        if (vf === '1') {
            delt.addClass('vchoice-selected');
        }
    }

    if (render_format === 'recommend' || render_format === 'top') {
        // insert time filtering options for these two views
        elt.append($('<div>').addClass('fdivider').html('|'));
        for (var i = 0; i < time_ranges.length; i++) {
            var time_range = time_ranges[i];
            var aelt = elt.append($('<a>').attr('href', '/' + link_endpoint + '?' + 'timefilter=' + time_range + '&vfilter=' + vf));
			elt.append(aelt);
			var delt = $('<div>').addClass('timechoice').html(time_txt[time_range]);
			aelt.append(delt);
            if (tf == time_range) {
                delt.addClass('timechoice-selected');
            } // also render as chosen
        }
    }

	elt.append($('<div>').addClass('divider col s12'));
	// If render format is most similar paper remove info bar
	if(render_format === 'paper'){
		$("#info").remove();
	}
});
