// here we populate papers into #rtable
var pointer_ix = 0; // points to next paper in line to be added to #rtable
var showed_end_msg = false;

function addPapers(num, dynamic) {
    if (papers.length === 0) {
        return;
    } // nothing to display

    var base_ix = pointer_ix;
    var msg = '';
    for (var i = 0; i < num; i++) {
        var ix = base_ix + i;
        var root = $("#end");
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
        var saveimg = $('<a>').attr('href', '').attr('id', 'lib' + p.pid).attr('target', '_blank').html(lib_state);
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
                return false;
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
