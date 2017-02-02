import pymongo
from hashlib import md5
from flask import Flask, request, session, url_for, redirect, \
     render_template, abort, g, flash, _app_ctx_stack
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug import check_password_hash, generate_password_hash
from bson.objectid import ObjectId
import cPickle as pickle
import numpy as np
import json
import time
import dateutil.parser
import argparse
from random import shuffle
import re
import os
import utils
import datetime

# database configuration
client = pymongo.MongoClient('localhost', 27017)
db = client['arxiv-sanity']
db_users = db['users']
db_papers = db['papers']

# DATABASE = 'as.db'
if os.path.isfile('secret_key.txt'):
  SECRET_KEY = open('secret_key.txt', 'r').read()
else:
  SECRET_KEY = 'devkey, should be in a file'
app = Flask(__name__)
app.config.from_object(__name__)
limiter = Limiter(app, key_func=get_remote_address, global_limits=["100 per hour", "20 per minute"])

SEARCH_DICT = {}

# -----------------------------------------------------------------------------
# utilities for database interactions
# -----------------------------------------------------------------------------
# to initialize the database: sqlite3 as.db < schema.sql
# def connect_db():
#   sqlite_db = sqlite3.connect(DATABASE)
#   sqlite_db.row_factory = sqlite3.Row # to return dicts rather than tuples
#   return sqlite_db

@app.before_request
def before_request():
  # retrieve user object from the database if user_id is set
  g.user = None
  if 'user_id' in session:
    g.user = db_users.find_one({"_id": ObjectId(session['user_id'])})


def get_user_id(username):
  """Convenience method to look up the id for a username."""
  user = db_users.find_one({"username":username})
  return str(user['_id']) if user else None

def get_username(user_id):
  """Convenience method to look up the username for a user."""
  user = db_users.find_one({"_id":user_id})
  return user['username'] if user else None

# -----------------------------------------------------------------------------
# search/sort functionality
# -----------------------------------------------------------------------------
def papers_shuffle():
  ks = db.keys()
  shuffle(ks)
  return [db[k] for k in ks]

def date_sort():
  scores = []
  for p in db_papers.find():
    timestruct = dateutil.parser.parse(p['updated'])
    p['time_updated'] = int(timestruct.strftime("%s"))
    scores.append((p['time_updated'], p))
  scores.sort(reverse=True)
  out = [sp[1] for sp in scores]
  return out

def papers_search(qraw):
  qparts = qraw.lower().strip().split() # split by spaces
  # use reverse index and accumulate scores
  scores = []
  for p in db_papers.find():
    score = sum(SEARCH_DICT[p['raw_id']].get(q,0) for q in qparts)
    if score == 0:
      continue # no match whatsoever, dont include
    # give a small boost to more recent papers
    score += 0.0001*p['tscore']
    scores.append((score, p))
  scores.sort(reverse=True) # descending
  out = [x[1] for x in scores if x[0] > 0]
  return out

def strip_version(idstr):
  """ identity function if arxiv id has no version, otherwise strips it. """
  parts = idstr.split('v')
  return parts[0]

def papers_similar(pid):
  rawpid = strip_version(pid)

  # check if we have this paper at all, otherwise return empty list
  if not db_papers.find_one({"raw_id": rawpid}):
    return []

  # check if we have distances to this specific version of paper id (includes version)
  if pid in sim_dict:
    # good, simplest case: lets return the papers
    return [db_papers.find_one({"raw_id":strip_version(k)}) for k in sim_dict[pid]]
  else:
    # ok we don't have this specific version. could be a stale URL that points to,
    # e.g. v1 of a paper, but due to an updated version of it we only have v2 on file
    # now. We want to use v2 in that case.
    # lets try to retrieve the most recent version of this paper we do have
    ks = sim_dict.keys()
    kok = [k for k in sim_dict.iterkeys() if rawpid in k]
    if kok:
      # ok we have at least one different version of this paper, lets use it instead
      id_use_instead = kok[0]
      return [db_papers.find_one({"raw_id":strip_version(k)}) for k in sim_dict[id_use_instead]]
    else:
      # return just the paper. we dont have similarities for it for some reason
      return [db_papers.find_one({"raw_id":rawpid})]

def papers_from_library():
  out = []
  if g.user:
    # user is logged in, lets fetch their saved library data
    libids = [strip_version(paper['paper_id']) for paper in folder['papers'] for folder in g.user['library']]
    out = [db_papers.find_one({"_raw": x}) for x in libids]
    out = sorted(out, key=lambda k: k['updated'], reverse=True)
  return out

def papers_from_svm(recent_days=None):
  out = []
  if g.user:

    uid = session['user_id']
    if not uid in user_sim:
      return []

    user_library = query_db('''select * from library where user_id = ?''', [uid])
    libids = {strip_version(x['paper_id']) for x in user_library}

    plist = user_sim[uid]
    out = [db[x] for x in plist if not x in libids]

    if recent_days is not None:
      # filter as well to only most recent papers
      curtime = int(time.time()) # in seconds
      out = [x for x in out if curtime - x['time_updated'] < recent_days*24*60*60]

  return out

def papers_filter_version(papers, v):
  if v != '1':
    return papers # noop
  intv = int(v)
  filtered = [p for p in papers if p['version'] == intv]
  return filtered

def encode_json(ps, n=10, send_images=True, send_abstracts=True):

  libids = set()
  if g.user:
    # user is logged in, lets fetch their saved library data
    uid = session['user_id']
    user_library = db_users.find({"_id": uid})
    libids = {strip_version(x['paper_id']) for x in user_library}

  ret = []
  for i in xrange(min(len(ps),n)):
    p = ps[i]
    idvv = '%sv%d' % (p['raw_id'], p['version'])
    struct = {}
    struct['title'] = p['title']
    struct['pid'] = idvv
    struct['category'] = p['arxiv_primary_category']['term']
    struct['authors'] = [a['name'] for a in p['authors']]
    struct['link'] = p['link']
    struct['in_library'] = 1 if p['raw_id'] in libids else 0
    if send_abstracts:
      struct['abstract'] = p['summary']
    if send_images:
      struct['img'] = '/static/thumbs/' + idvv + '.pdf.jpg'
    struct['tags'] = [t['term'] for t in p['tags']]

    timestruct = dateutil.parser.parse(p['updated'])
    struct['published_time'] = '%s/%s/%s' % (timestruct.month, timestruct.day, timestruct.year)
    timestruct = dateutil.parser.parse(p['published'])
    struct['originally_published_time'] = '%s/%s/%s' % (timestruct.month, timestruct.day, timestruct.year)

    cc = p.get('arxiv_comment', '')
    if len(cc) > 100:
      cc = cc[:100] + '...' # crop very long comments
    struct['comment'] = cc

    ret.append(struct)
  return ret

# -----------------------------------------------------------------------------
# flask request handling
# -----------------------------------------------------------------------------

# "1511.08198v1" is an example of a valid arxiv id that we accept
def isvalidid(pid):
  return re.match('^\d+\.\d+(v\d+)?$', pid)

def default_context(papers, **kws):
  top_papers = encode_json(papers, args.num_results)
  ans = dict(papers=top_papers, numresults=len(papers), totpapers=db_papers.find().count(), msg='')
  ans.update(kws)
  return ans

@app.route("/")
def intmain():
  vstr = request.args.get('vfilter', 'all')
  papers = DATE_SORTED_PAPERS # precomputed
  papers = papers_filter_version(papers, vstr)
  ctx = default_context(papers, render_format='recent',
                        msg='Showing most recent Arxiv papers:')
  return render_template('main.html', **ctx)

@app.route("/<request_pid>")
def rank(request_pid=None):
  if not isvalidid(request_pid):
    return '' # these are requests for icons, things like robots.txt, etc
  papers = papers_similar(request_pid)
  ctx = default_context(papers, render_format='paper')
  return render_template('main.html', **ctx)

@app.route("/search", methods=['GET'])
def search():
  q = request.args.get('q', '') # get the search request
  papers = papers_search(q) # perform the query and get sorted documents
  ctx = default_context(papers, render_format="search")
  return render_template('main.html', **ctx)

@app.route('/recommend', methods=['GET'])
def recommend():
  """ return user's svm sorted list """
  ttstr = request.args.get('timefilter', 'week') # default is week
  vstr = request.args.get('vfilter', 'all') # default is all (no filter)
  legend = {'day':1, '3days':3, 'week':7, 'month':30, 'year':365}
  tt = legend.get(ttstr, None)
  papers = papers_from_svm(recent_days=tt)
  papers = papers_filter_version(papers, vstr)
  ctx = default_context(papers, render_format='recommend',
                        msg='Recommended papers: (based on SVM trained on tfidf of papers in your library, refreshed every day or so)' if g.user else 'You must be logged in and have some papers saved in your library.')
  return render_template('main.html', **ctx)

@app.route('/top', methods=['GET'])
def top():
  """ return top papers """
  ttstr = request.args.get('timefilter', 'week') # default is week
  vstr = request.args.get('vfilter', 'all') # default is all (no filter)
  legend = {'day':1, '3days':3, 'week':7, 'month':30, 'year':365, 'alltime':10000}
  tt = legend.get(ttstr, 7)
  curtime = datetime.datetime.now() # in seconds
  papers = [p for p in TOP_SORTED_PAPERS if curtime - p['updated_parsed'] < datetime.timedelta(days=tt)]
  papers = papers_filter_version(papers, vstr)
  ctx = default_context(papers, render_format='top',
                        msg='Top papers based on people\'s libraries:')
  return render_template('main.html', **ctx)

@app.route('/library')
def library():
  """ render user's library """
  papers = papers_from_library()
  print papers
  ret = encode_json(papers, 500) # cap at 500 papers in someone's library. that's a lot!
  if g.user:
    msg = '%d papers in your library:' % (len(ret), )
  else:
    msg = 'You must be logged in. Once you are, you can save papers to your library (with the save icon on the right of each paper) and they will show up here.'
  ctx = default_context(papers, render_format='library',
                        msg=msg)
  return render_template('main.html', **ctx)

@app.route('/libtoggle', methods=['POST'])
def review():
  """ user wants to toggle a paper in his library """

  # make sure user is logged in
  if not g.user:
    return 'NO' # fail... (not logged in). JS should prevent from us getting here.

  idvv = request.form['pid'] # includes version
  if not isvalidid(idvv):
    return 'NO' # fail, malformed id. weird.
  pid = strip_version(idvv)
  if not pid in db:
    return 'NO' # we don't know this paper. wat

  uid = session['user_id'] # id of logged in user

  # check this user already has this paper in library
  record = g.user['library']
  record = query_db('''select * from library where
          user_id = ? and paper_id = ?''', [uid, pid], one=True)
  print record

  ret = 'NO'
  if record:
    # record exists, erase it.
    g.db.execute('''delete from library where user_id = ? and paper_id = ?''', [uid, pid])
    g.db.commit()
    #print 'removed %s for %s' % (pid, uid)
    ret = 'OFF'
  else:
    # record does not exist, add it.
    rawpid = strip_version(pid)
    g.db.execute('''insert into library (paper_id, user_id, update_time) values (?, ?, ?)''',
        [rawpid, uid, int(time.time())])
    g.db.commit()
    #print 'added %s for %s' % (pid, uid)
    ret = 'ON'

  return ret

@app.route('/login', methods=['POST'])
def login():
  """ logs in the user. if the username doesn't exist creates the account """

  if not request.form['username']:
    flash('You have to enter a username')
  username = request.form['username']
  if not request.form['password']:
    flash('You have to enter a password')
  password = request.form['password']
  if get_user_id(username):
    # username already exists, fetch all of its attributes
    user = db_users.find_one({'username':username})
    if check_password_hash(user['pw_hash'], password):
      # password is correct, log in the user
      session['user_id'] = get_user_id(username)
      flash('User ' + username + ' logged in.')
    else:
      # incorrect password
      flash('User ' + username + ' already exists, wrong password.')
  else:
    # create account and log in
    creation_time = int(time.time())
    user = {
        "username": username,
        "pw_hash": generate_password_hash(password),
        "creation_time": creation_time,
        "library": [],
        "folders": []
    }
    user_id = str(db_users.insert_one(user).inserted_id)

    session['user_id'] = user_id
    flash('New account %s created' % (username, ))

  return redirect(url_for('intmain'))

@app.route('/logout')
def logout():
  session.pop('user_id', None)
  flash('You were logged out')
  return redirect(url_for('intmain'))

# -----------------------------------------------------------------------------
# int main
# -----------------------------------------------------------------------------
if __name__ == "__main__":

  parser = argparse.ArgumentParser()
  parser.add_argument('-p', '--prod', dest='prod', action='store_true', help='run in prod?')
  parser.add_argument('-r', '--num_results', dest='num_results', type=int, default=200, help='number of results to return per query')
  parser.add_argument('--port', dest='port', type=int, default=5000, help='port to serve on')
  args = parser.parse_args()
  print args

  # print 'loading db.p...'
  # db = pickle.load(open('db.p', 'rb'))

  print 'loading tfidf_meta.p...'
  meta = pickle.load(open("tfidf_meta.p", "rb"))
  vocab = meta['vocab']
  idf = meta['idf']

  print 'loading sim_dict.p...'
  sim_dict = pickle.load(open("sim_dict.p", "rb"))

  print 'loading user_sim.p...'
  if os.path.isfile('user_sim.p'):
    user_sim = pickle.load(open('user_sim.p', 'rb'))
  else:
    user_sim = {}

  print 'precomputing papers date sorted...'
  DATE_SORTED_PAPERS = date_sort()

  # if not os.path.isfile(DATABASE):
  #   print 'did not find as.db, trying to create an empty database from schema.sql...'
  #   print 'this needs sqlite3 to be installed!'
  #   os.system('sqlite3 as.db < schema.sql')

  # compute top papers in peoples' libraries
  print 'computing top papers...'
  def get_popular():
    # sqldb = sqlite3.connect(DATABASE)
    # sqldb.row_factory = sqlite3.Row # to return dicts rather than tuples
    # libs = sqldb.execute('''select * from library''').fetchall()
    counts = {}
    for user in db_users.find():
        if 'library' in user:
            for paper in user['library']:
                pid = paper['raw_id']
                counts[pid] = counts.get(pid, 0) + 1
    return counts
  top_counts = get_popular()
  top_paper_counts = sorted([(v,k) for k,v in top_counts.iteritems() if v > 0], reverse=True)
  print top_paper_counts[:min(30, len(top_paper_counts))]
  TOP_SORTED_PAPERS = [db_papers.find_one({"raw_id": q[1]}) for q in top_paper_counts]

  # compute min and max time for all papers
  tts = [time.mktime(dateutil.parser.parse(p['updated']).timetuple()) for p in db_papers.find()]
  ttmin = min(tts)*1.0
  ttmax = max(tts)*1.0
  for p in db_papers.find():
    tt = time.mktime(dateutil.parser.parse(p['updated']).timetuple())
    p['tscore'] = (tt-ttmin)/(ttmax-ttmin)
    db_papers.save(p)

  # some utilities for creating a search index for faster search
  punc = "'!\"#$%&\'()*+,./:;<=>?@[\\]^_`{|}~'" # removed hyphen from string.punctuation
  trans_table = {ord(c): None for c in punc}
  def makedict(s, forceidf=None, scale=1.0):
    words = set(s.lower().translate(trans_table).strip().split())
    out = {}
    for w in words: # todo: if we're using bigrams in vocab then this won't search over them
      if forceidf is None:
        if w in vocab:
          # we have idf for this
          idfval = idf[vocab[w]]*scale
        else:
          idfval = 1.0*scale # assume idf 1.0 (low)
      else:
        idfval = forceidf
      out[w] = idfval
    return out

  def merge_dicts(dlist):
    out = {}
    for d in dlist:
      for k,v in d.iteritems():
        out[k] = out.get(k,0) + v
    return out

  # caching: check if db.p is younger than search_dict.p
  recompute_index = True
  # if os.path.isfile('search_dict.p'):
  #   db_modified_time = os.path.getmtime('db.p')
  #   search_modified_time = os.path.getmtime('search_dict.p')
  #   if search_modified_time > db_modified_time:
  #     # search index exists and is more recent, no need
  #     recompute_index = False
  if recompute_index:
    print 'building an index for faster search...'
    for p in db_papers.find():
      dict_title = makedict(p['title'], forceidf=5, scale=3)
      dict_authors = makedict(' '.join(x['name'] for x in p['authors']), forceidf=5)
      dict_categories = {x['term'].lower():5 for x in p['tags']}
      if 'and' in dict_authors:
        # special case for "and" handling in authors list
        del dict_authors['and']
      dict_summary = makedict(p['summary'])
      SEARCH_DICT[p['raw_id']] = merge_dicts([dict_title, dict_authors, dict_categories, dict_summary])
    # and cache it in file
    print 'writing search_dict.p as cache'
    utils.safe_pickle_dump(SEARCH_DICT, 'search_dict.p')
  else:
    print 'loading cached index for faster search...'
    SEARCH_DICT = pickle.load(open('search_dict.p', 'rb'))

  # start
  if args.prod:
    # run on Tornado instead, since running raw Flask in prod is not recommended
    print 'starting tornado!'
    from tornado.wsgi import WSGIContainer
    from tornado.httpserver import HTTPServer
    from tornado.ioloop import IOLoop
    from tornado.log import enable_pretty_logging
    enable_pretty_logging()
    http_server = HTTPServer(WSGIContainer(app))
    http_server.listen(args.port)
    IOLoop.instance().start()
    #app.run(host='0.0.0.0', threaded=True)
  else:
    print 'starting flask!'
    app.debug = True
    app.run(port=args.port)
