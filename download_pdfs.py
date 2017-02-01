import urllib2
import shutil
import time
import os
import random
from pymongo import MongoClient
import gridfs

os.system('mkdir -p pdf')  # ?

timeout_secs = 10  # after this many seconds we give up on a paper
numok = 0
numtot = 0

# Connecting to mongo
client = MongoClient()
try:
    db = client['arxivSanity']
    fs = gridfs.GridFS(db)
    collection = db['papers']
except Exception, e:
    print 'Could not connect to mongo database. Error: '
    print e
    sys.exit(1)

for j in collection.find({'is_pdf_fetched': False}):
    pdfs = [x['href'] for x in j['links'] if x['type'] == 'application/pdf']
    assert len(pdfs) == 1
    pdf_url = pdfs[0] + '.pdf'

    # try retrieve the pdf
    numtot += 1
    try:
        print 'fetching %s.' % (pdf_url)
        req = urllib2.urlopen(pdf_url, None, timeout_secs)
        oid = fs.put(req)
        time.sleep(0.1 + random.uniform(0, 0.2))
        numok += 1
        # Update boolean in db
        collection.update_one({'_id': j['_id']}, {'$set': {'is_pdf_fetched': True, 'pdf_id': oid}})
        print '%d/%d of %d downloaded ok.' % (numok, numtot, collection.count())
    except Exception, e:
        print 'error downloading: ', pdf_url
        print e


print 'final number of papers downloaded okay: %d/%d' % (numok, collection.count())
