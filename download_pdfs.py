import pymongo
import cPickle as pickle
import urllib2
import shutil
import time
import os
import random

client = pymongo.MongoClient('localhost', 27017)
db = client['arxiv-sanity']
papers = db['papers']

os.system('mkdir -p pdf') # ?

timeout_secs = 10 # after this many seconds we give up on a paper
numok = 0
numtot = 0
have = set(os.listdir('pdf')) # get list of all pdfs we already have
for paper in papers.find():

  pdfs = [x['href'] for x in paper['links'] if x['type'] == 'application/pdf']
  assert len(pdfs) == 1
  pdf_url = pdfs[0] + '.pdf'
  basename = pdf_url.split('/')[-1]
  fname = os.path.join('pdf', basename)

  # try retrieve the pdf
  numtot += 1
  try:
    if not basename in have:
      print 'fetching %s into %s' % (pdf_url, fname)
      req = urllib2.urlopen(pdf_url, None, timeout_secs)
      with open(fname, 'wb') as fp:
          shutil.copyfileobj(req, fp)
      time.sleep(0.1 + random.uniform(0,0.2))
    else:
      print '%s exists, skipping' % (fname, )
    numok+=1
  except Exception, e:
    print 'error downloading: ', pdf_url
    print e

  print '%d/%d of %d downloaded ok.' % (numok, numtot, papers.find().count())

print 'final number of papers downloaded okay: %d/%d' % (numok, papers.find().count())
