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

        tldiv.append($('<span>').addClass('ts').append($('<a>').attr({href: p.link, target: '_blank'}).html(p.title)));
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
        trdiv.append($('<a>').attr({href: pdf_url, target: '_blank'}).html('pdf'));


        if (typeof p.img !== 'undefined') {
            div.append($('<div>').addClass('paper-image center-align').append($('<img>').attr('src', p.img)));
        }

        var content_div= $('<div>').addClass('card-content');

        if (typeof p.abstract !== 'undefined') {
            content_div.append($('<strong>').html('Abstract:'));
            var abdiv = content_div.append($('<p>').html(p.abstract));
            if (dynamic) {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, abdiv]); //typeset the added paper
            }
        }

        if (p.note !== '') {
            content_div.append($('<strong>').html('Note:'));
            content_div.append($('<p>').attr('id', 'note' + p.pid).addClass('note').html(marked(p.note)));
        }

        div.append(content_div);

        // action items for each paper
        var adiv = $('<div>').addClass('card-action');
		div.append(adiv);

        var lib_state = p.in_library === 1 ? 'Saved' : 'Save';
        var saveimg = $('<a>').attr({href: '', target: '_blank', id: 'lib' + p.pid}).html(lib_state);
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

        var note_state = p.note !== '' ? 'Edit note' : 'Add note';
        editnote = $('<a>').attr({href: '#md', target: '_blank', id: 'note_state' + p.pid}).html(note_state);

        adiv.append(editnote);
        // attach a handler for in-library toggle
        editnote.on('click', function(pid, note) {
            return function() {
                $("#note_type").val('paper');
                $("#note_pid").val(pid);
                $('#raw_text').val(note);
                $('#compiled_md').val(marked(note));
            };
        }(p.pid, p.note)); // close over the pid and handle to the image

        // rank by tfidf similarity
        adiv.append($('<a>').attr({href: '/' + p.pid, target: '_blank', id: 'sim' + p.pid}).html('Show similar'));

        adiv.append($('<a>').attr({target: '_blank', href: 'http://www.shortscience.org/paper?bibtexKey=' + p.pid}).html('review'));

        if(render_format == 'paper' && ix === 0){
            root.append($('<div>').addClass('card paperdivider').append($('<span>').html('Most similar papers:')));
        }
    }
}
