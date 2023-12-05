import { createBid } from '../src/bidfactory.js'
import adapterManager from '../src/adapterManager.js'
import { insertElement, logMessage, logWarn } from '../src/utils.js'
import { getGlobal } from '../src/prebidGlobal.js';

let _addBidResponse;
let _done;
let responsesProcessed = {};
const prebidInstance = getGlobal()
let UDM_ADAPTER_VERSION = '7.43.0-8.6.0C';
let PREBID_VERSION = prebidInstance.version;
let PREBID_NAME = '$$PREBID_GLOBAL$$';
let UDM_VENDOR_ID = '159';
let LATEST_TEST_DATE = '2023-08-04';

let UnderdogMediaAdapter = function UnderdogMediaAdapter() {
  logMessage('Initializing UDM Adapter');
  logMessage('Global Prebid Name: $$PREBID_GLOBAL$$');
  logMessage(`PBJS Version: ${prebidInstance.version}`);
  logMessage(`UDM adapter version: ${UDM_ADAPTER_VERSION} Updated/tested: ${LATEST_TEST_DATE}`);

  let getJsStaticUrl = 'https://bid.underdog.media/udm_header_lib.js';

  prebidInstance.handleUnderdogMediaCB = function () {};

  function _callBids(bidderRequest, addBidResponse, done) {
    _addBidResponse = addBidResponse;
    _done = done;
    let gdpr = {
      gdprApplies: false,
      consentGiven: true,
      consentData: '',
      prebidConsentData: bidderRequest.gdprConsent
    }
    if (bidderRequest && bidderRequest.gdprConsent) {
      if (typeof bidderRequest.gdprConsent.gdprApplies !== 'undefined') {
        gdpr.gdprApplies = !!(bidderRequest.gdprConsent.gdprApplies);
      }
      if (bidderRequest.gdprConsent.vendorData && bidderRequest.gdprConsent.vendorData.vendorConsents && typeof bidderRequest.gdprConsent.vendorData.vendorConsents[UDM_VENDOR_ID] !== 'undefined') {
        gdpr.consentGiven = !!(bidderRequest.gdprConsent.vendorData.vendorConsents[UDM_VENDOR_ID]);
      }
      if (typeof bidderRequest.gdprConsent.consentString !== 'undefined') {
        gdpr.consentData = bidderRequest.gdprConsent.consentString;
      }
    }

    if (!gdpr.gdprApplies || gdpr.consentGiven) {
      if (typeof window.udm_header_lib === 'undefined') {
        loadScript(getJsStaticUrl, function () {
          bid(bidderRequest, gdpr);
        });
      } else {
        bid(bidderRequest, gdpr);
      }
    } else {
      let sid = bidderRequest.bids[0].params.siteId;
      loadScript(`https://udmserve.net/udm/img.fetch?tid=1;dt=9;sid=${sid};gdprApplies=${gdpr.gdprApplies};consentGiven=${gdpr.consentGiven};`, function () {
        logWarn('UDM Request Cancelled - No GDPR Consent');
        _done();
      })
    }
  }

  function loadScript(url, callback) {
    let script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;

    // Execute a callback if necessary
    if (callback && typeof callback === 'function') {
      if (script.readyState) {
        script.onreadystatechange = function () {
          if (script.readyState === 'loaded' || script.readyState === 'complete') {
            script.onreadystatechange = null;
            callback();
          }
        };
      } else {
        script.onload = function () {
          callback();
        };
      }
    }
    script.src = url;

    // add the new script tag to the page
    insertElement(script);
  }

  function bid(bidderRequest, gdpr) {
    responsesProcessed[bidderRequest.auctionId] = 0;
    let bids = bidderRequest.bids;
    let mappedBids = [];
    for (let i = 0; i < bids.length; i++) {
      let bidRequest = bids[i];
      let callback = bidResponseCallback(bidRequest, bids.length);
      let bidRequestSizes = bidRequest.mediaTypes && bidRequest.mediaTypes.banner && bidRequest.mediaTypes.banner.sizes ? bidRequest.mediaTypes.banner.sizes : bidRequest.sizes;
      mappedBids.push({
        auctionId: bidRequest.auctionId,
        auctionStart: bidderRequest.auctionStart,
        auctionTimeout: bidderRequest.timeout,
        bidder: bidRequest.bidder,
        sizes: bidRequestSizes,
        siteId: bidRequest.params.siteId,
        bidfloor: bidRequest.params.bidfloor,
        adunitcode: bidRequest.adUnitCode,
        placementCode: bidRequest.adUnitCode,
        divId: bidRequest.params.divId,
        subId: bidRequest.params.subId,
        callback: callback,
        uspConsent: bidderRequest.uspConsent
      });
    }

    if (window.udm_header_lib.storePubPrebidInfo) {
      window.udm_header_lib.storePubPrebidInfo({
        adapterVersion: UDM_ADAPTER_VERSION,
        prebidName: PREBID_NAME,
        prebidVersion: PREBID_VERSION
      })
    }

    if (gdpr.gdprApplies) {
      if (window.udm_header_lib.storeGDPRConsentData) {
        window.udm_header_lib.storeGDPRConsentData(gdpr)
      }
    }

    if (bidderRequest.uspConsent) {
      if (window.udm_header_lib.storeUSPConsentData) {
        window.udm_header_lib.storeUSPConsentData(bidderRequest.uspConsent)
      }
    }

    let udmBidRequest = new window.udm_header_lib.BidRequestArray(mappedBids);
    udmBidRequest.send();
  }

  function bidResponseCallback(bid, bids) {
    return function (bidResponse) {
      bidResponseAvailable(bid, bidResponse, bids);
    };
  }

  function bidResponseAvailable(bidRequest, bidResponse, bids) {
    if (bidResponse.bids.length > 0) {
      for (let i = 0; i < bidResponse.bids.length; i++) {
        let udmBid = bidResponse.bids[i];
        let bid = createBid(1, bidRequest);
        if (udmBid.udmDebug) {
          bid.udmDebug = udmBid.udmDebug;
        }
        bid.requestId = bidRequest.bidId;
        bid.cpm = udmBid.cpm;
        bid.width = udmBid.width;
        bid.height = udmBid.height;
        bid.ttl = udmBid.ttl || 60;
        bid.netRevenue = false;
        bid.currency = 'USD';
        bid.bidderCode = bidRequest.bidder;
        bid.auctionId = bidRequest.auctionId;
        bid.adUnitCode = bidRequest.adUnitCode;
        bid.trueBidder = udmBid.bidderCode;
        bid.creativeId = udmBid.creativeId;
        bid.meta = {} // internals are throwing an error related to dchain since it assumes meta existence

        if (udmBid.ad_url !== undefined) {
          bid.adUrl = udmBid.ad_url;
        } else if (udmBid.ad_html !== undefined) {
          bid.ad = udmBid.ad_html.replace('UDM_ADAPTER_VERSION', 'P_' + PREBID_VERSION + '_A_' + UDM_ADAPTER_VERSION);
        } else {
          logMessage('Underdogmedia bid is lacking both ad_url and ad_html, skipping bid');
          continue;
        }
        _addBidResponse(bidRequest.adUnitCode, bid);
      }
    } else {
      let nobid = createBid(2, bidRequest);
      nobid.bidderCode = bidRequest.bidder;
      nobid.meta = {} // internals are throwing an error related to dchain since it assumes meta existence
      _addBidResponse(bidRequest.adUnitCode, nobid);
    }
    responsesProcessed[bidRequest.auctionId]++;
    if (responsesProcessed[bidRequest.auctionId] >= bids) {
      delete responsesProcessed[bidRequest.auctionId];
      _done();
    }
  }

  function getSpec() {
    return {
      onBidWon: (bid) => {
        logMessage('Underdog Media onBidWon Event', bid);
      },
      onSetTargeting: (bid) => {
        logMessage('Underdog Media onSetTargeting Event', bid);
      }
    }
  }

  return {
    callBids: _callBids,
    getSpec: getSpec
  };
};

adapterManager.registerBidAdapter(new UnderdogMediaAdapter(), 'underdogmedia');
