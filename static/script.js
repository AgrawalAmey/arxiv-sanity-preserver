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

    var root = d3.select("#end");

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
                root.append('div').classed('card white col s12', true).html(msg);
                showed_end_msg = true;
            }
            break;
        }
        pointer_ix++;

        root = d3.select("#rtable");
        var p = papers[ix];
        var div = root.append('div').classed('card', true).attr('id', p.pid);

        // Generate OpenURL COinS metadata element -- readable by Zotero, Mendeley, etc.
        var ocoins_span = div.append('span').classed('Z3988', true).attr('title', build_ocoins_str(p));

        var tdiv = div.append('div').classed('card-title row', true);

        var tldiv = tdiv.append('div').classed('col s8', true);
        tldiv.append('span').classed('ts', true).append('a').attr('href', p.link).attr('target', '_blank').html(p.title);
        tldiv.append('br');
        tldiv.append('span').classed('as', true).html(build_authors_html(p.authors));
        tldiv.append('br');
        tldiv.append('span').classed('ds', true).html(p.published_time);
        if (p.originally_pubslished_time !== p.published_time) {
            tldiv.append('span').classed('ds2', true).html('(v1: ' + p.originally_published_time + ')');
        }
        tldiv.append('span').classed('cs', true).html(build_categories_html(p.tags));
        tldiv.append('br');
        tldiv.append('span').classed('ccs', true).html(p.comment);

        var trdiv = tdiv.append('div').classed('col s4 right-align', true);
        // Paper id
        trdiv.append('span').classed('spid', true).html(p.pid);
        trdiv.append('br');
        // access PDF of the paper
        // convert from /abs/ link to /pdf/ link. url hacking. slightly naughty
        var pdf_link = p.link.replace("abs", "pdf");
        // replace failed, lets fall back on arxiv landing page
        if (pdf_link === p.link) {
            pdf_url = pdf_link;
        } else {
            pdf_url = pdf_link + '.pdf';
        }
        trdiv.append('a').attr('href', pdf_url).attr('target', '_blank').html('pdf');


        if (typeof p.img !== 'undefined') {
            div.append('div').classed('paper-image align-center', true).append('img').attr('src', p.img);
        }

        if (typeof p.abstract !== 'undefined') {
            var abdiv = div.append('div').classed('card-content', true).append('p').html(p.abstract);
            if (dynamic) {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, abdiv[0]]); //typeset the added paper
            }
        }


        // action items for each paper
        var adiv = div.append('div').classed('card-action', true);

        var lib_state = p.in_library === 1 ? 'Saved' : 'Save';
        var saveimg = adiv.append('a').attr('href', '#').attr('id', 'lib' + p.pid).html(lib_state);
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
        var similar_span = adiv.append('a').attr('id', 'sim' + p.pid).attr('href', '#').html('Show similar');
        similar_span.on('click', function(pid) { // attach a click handler to redirect for similarity search
            return function() {
                window.location.replace('/' + pid);
            };
        }(p.pid)); // closer over the paper id

        adiv.append('a').attr('href', 'http://www.shortscience.org/paper?bibtexKey=' + p.pid).html('review');

        if (render_format == 'paper' && ix === 0) {
            // lets insert a divider/message
            root.append('div').classed('card paperdivider', true).html('Most similar papers:');
        }
    }
}

// when page loads...
$(document).ready(function() {

    urlq = QueryString.q;

    // display message, if any
    if (msg !== '') {
        d3.select("#info").append('div').classed('col s12', true).html(msg);
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
            addPapers(5, true);
        }
    });

    if (typeof urlq !== 'undefined') {
        d3.select("#qfield").attr('value', urlq.replace(/\+/g, " "));
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

    var elt = d3.select('#recommend-time-choice');
    // set up time filtering options
    if (render_format === 'recommend' || render_format === 'top' || render_format === 'recent') {
        // insert version filtering options for these views
        var vflink = vf === 'all' ? '1' : 'all'; // toggle only showing v1 or not
        if (render_format === 'recent') {
            var aelt = elt.append('a').attr('href', '/' + link_endpoint + '?' + '&vfilter=' + vflink); // leave out timefilter from this page
        } else {
            var aelt = elt.append('a').attr('href', '/' + link_endpoint + '?' + 'timefilter=' + time_range + '&vfilter=' + vflink);
        }
        var delt = aelt.append('div').classed('vchoice', true).html('Only show v1');
        if (vf === '1') {
            delt.classed('vchoice-selected', true);
        }
    }

    if (render_format === 'recommend' || render_format === 'top') {
        // insert time filtering options for these two views
        elt.append('div').classed('fdivider', true).html('|');
        for (var i = 0; i < time_ranges.length; i++) {
            var time_range = time_ranges[i];
            var aelt = elt.append('a').attr('href', '/' + link_endpoint + '?' + 'timefilter=' + time_range + '&vfilter=' + vf);
            var delt = aelt.append('div').classed('timechoice', true).html(time_txt[time_range]);
            if (tf == time_range) {
                delt.classed('timechoice-selected', true);
            } // also render as chosen
        }
    }

	elt.append('div').classed('divider col s12', true);
});

$(document).ready(function() {
    $('.modal').modal();
	$(".button-collapse").sideNav();
});
