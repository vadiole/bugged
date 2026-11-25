import os
import sys

GOOGLE = """ac ad ae al am as at az ba be bf bg bi bj bs bt by ca cat cd cf cg ch ci cl cm cn co.ao co.bw co.ck co.cr co.id co.il co.in co.jp co.ke co.kr co.ls co.ma co.mz co.nz co.th co.tz co.ug co.uk co.uz co.ve co.vi co.za co.zm co.zw com com.af com.ag com.ai com.ar com.au com.bd com.bh com.bn com.bo com.br com.bz com.co com.cu com.cy com.do com.ec com.eg com.et com.fj com.gh com.gi com.gt com.hk com.iq com.jm com.kh com.kw com.lb com.ly com.mm com.mt com.mx com.my com.na com.nf com.ng com.ni com.np com.om com.pa com.pe com.pg com.ph com.pk com.pr com.py com.qa com.sa com.sb com.sg com.sl com.sv com.tj com.tn com.tr com.tw com.ua com.uy com.vc com.vn cv cz de dj dk dm dz ee es eus fi fm fr ga ge gg gl gm gp gr gy hn hr ht hu ie im iq is it je jo kg ki kz la li lk lt lu lv md me mg mk ml mn ms mu mv mw ne ng nl no nr nu pl pn ps pt ro rs ru rw sc se sh si sk sm sn so sr st td tg tk tl tm tn to tt vg vu ws""".split()
AMAZON = "ae ca cn co.jp co.uk co.za com com.au com.be com.br com.mx com.tr de eg es fr ie in it nl pl sa se sg".split()
EBAY = "at be ca ch co.uk com com.au com.hk com.my com.sg de es fr ie it nl ph pl".split()

GLOBAL = """utm_*
gclid gclsrc dclid gbraid wbraid gad_source gad_campaignid srsltid _gl _ga
fbclid fb_action_ids fb_action_types fb_ref fb_source action_object_map action_type_map action_ref_map
igshid igsh
msclkid twclid ttclid li_fat_id epik sccid rdt_cid tblci yclid ysclid ymclid
mc_cid mc_eid _hsenc _hsmi __hssc __hstc __hsfp hsctatracking
hsa_acc hsa_ad hsa_cam hsa_grp hsa_kw hsa_la hsa_mt hsa_net hsa_ol hsa_src hsa_tgt hsa_ver
mkt_tok _openstat wickedid vero_id vero_conv oly_anon_id oly_enc_id _branch_match_id _branch_referrer
mtm_* pk_campaign pk_kwd pk_keyword pk_source pk_medium pk_content pk_cid s_cid
ml_subscriber ml_subscriber_hash rb_clickid irclickid unicorn_click_id sms_click sms_source sms_uph
guce_referrer guce_referrer_sig guccounter _bhlid _kx vgo_ee et_rid sfmc_id sfmc_activityid ss_email_id
bsft_clkid bsft_uid bsft_eid bsft_mid bsft_aaid bsft_ek
at_recipient_id at_recipient_list at_campaign at_medium at_campaign_type at_creation at_emailtype at_link_id at_link_origin at_link_type at_ptr_name at_send_date
oft_c oft_ck oft_d oft_id oft_ids oft_k oft_lk oft_sk
wt_mc __twitter_impression xtor cjevent ranmid raneaid ransiteid
adjust_tracker adjust_tracker_limit adjust_campaign adjust_adgroup adjust_creative adjust_referrer"""

HOSTS = {
    'youtube.com': 'si pp feature ab_channel source_ve_path',
    'youtu.be': 'si is feature',
    'x.com': 's t ref_src ref_url cxt cn',
    'twitter.com': 's t ref_src ref_url cxt cn',
    'facebook.com': 'mibextid rdid sfnsn __tn__ __cft__[0] __xts__[0] paipv fref hc_ref hc_location referral_story_type ref',
    'messenger.com': 'mibextid rdid sfnsn',
    'instagram.com': 'igsh igshid ig_rid ig_mid cplk dlrf exln igsi mdxt obrf psln rpxt srtk stkn vrfl xtok click_source ndid',
    'threads.com': 'xmt',
    'threads.net': 'xmt',
    'tiktok.com': '_d _r _t checksum embed_source is_from_webapp is_copy_url preview_pb refer referer_url referer_video_id sec_uid sec_user_id sender_device share_app_id share_author_id share_item_id share_link_id source timestamp tt_from u_code user_id',
    'linkedin.com': 'trk trkinfo trackingid trackingcode refid lipi original_referer originalreferer rcm ebp mcid',
    'reddit.com': 'share_id ref ref_source ref_campaign correlation_id post_index rdt $deep_link %24deep_link $3p %243p',
    'spotify.com': 'si dlsi referral',
    'amazon': 'ref ref_ tag ascsubtag linkcode linkid creative creativeasin camp content-id crid dib dib_tag qid sr sprefix social_share _encoding pd_rd_* pf_rd_* spia hydadcr refrid store_ref visitid ingress aaxitk cv_ct_* ms3_c dchild',
    'ebay': 'hash _trkparms _trksid amdata mkcid mkevt mkrid campid customid toolid ssspo ssuid sssrc',
    'aliexpress.com': 'algo_pvid algo_expid algo_exp_id btsid curpageloguid gps-id initiative_id pdp_npi pvid scm scm_id spm terminal_id utparam ws_ab_test aff_fcid aff_fsk aff_platform aff_trace_key sk dp',
    'aliexpress.us': 'algo_pvid algo_expid algo_exp_id btsid curpageloguid gps-id initiative_id pdp_npi pvid scm scm_id spm terminal_id utparam ws_ab_test aff_fcid aff_fsk aff_platform aff_trace_key sk dp',
    'aliexpress.ru': 'algo_pvid algo_expid algo_exp_id btsid curpageloguid gps-id initiative_id pdp_npi pvid scm scm_id spm terminal_id utparam ws_ab_test aff_fcid aff_fsk aff_platform aff_trace_key sk dp',
    'taobao.com': 'spm scm utparam pvid',
    'tmall.com': 'spm scm utparam pvid',
    'google': 'ved ei sxsrf sca_esv sca_upv iflsig fbs aqs gs_lcrp gs_lp gs_lcp gs_l sclient sourceid uact sei ictx oq rlz g_ep pcampaignid',
    'bing.com': 'cvid form pq qs sc sk sp',
    'msn.com': 'ocid cvid',
    'yahoo.com': 'ncid',
    'nytimes.com': 'smid sgrp referringsource impression_id',
    'medium.com': 'source',
    'substack.com': 'r triedredirect',
    'etsy.com': 'ref click_key click_sum organic_search_click',
    'imdb.com': 'ref_ pf_rd_*',
    'netflix.com': 'trackid trkid tctx',
    'walmart.com': 'ath*',
    'temu.com': '_x_* refer_page_* _p_rfs',
    'shein.com': 'ici',
    'bilibili.com': 'vd_source spm_id_from share_source share_medium share_plat share_session_id share_tag share_from buvid msource plat_id seid unique_k up_id timestamp bbid is_story_h5 from_source refer_from',
    'xiaohongshu.com': 'xhsshare share_id app_platform app_version apptime appuid share_from_user_hidden share_channel',
    'apple.com': 'itscg itsct',
    'steampowered.com': 'snr',
    'steamcommunity.com': 'snr',
    'tumblr.com': 'source',
    'twitch.tv': 'tt_medium tt_content',
}

lines = {}
def add(host, params):
    ps = params.split()
    assert len(ps) == len(set(ps)), (host, [p for p in ps if ps.count(p) > 1])
    assert host not in lines, host
    lines[host] = ps

for h, p in HOSTS.items():
    if h == 'google':
        for t in GOOGLE: add('google.' + t, p)
    elif h == 'amazon':
        for t in AMAZON: add('amazon.' + t, p)
    elif h == 'ebay':
        for t in EBAY: add('ebay.' + t, p)
    else:
        add(h, p)

g = GLOBAL.split()
assert len(g) == len(set(g)), [p for p in g if g.count(p) > 1]
with open(sys.argv[1], 'w') as f:
    f.write('* ' + ' '.join(g) + '\n')
    for h in sorted(lines):
        f.write(h + ' ' + ' '.join(lines[h]) + '\n')
print(len(lines) + 1, 'lines,', len(g), 'global params')

base = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'redirects.base')).read().split('\n')
redirects = sorted([l for l in base if l] + ['google.%s/url q url' % t for t in GOOGLE])
assert len(redirects) == len(set(redirects))
with open(sys.argv[2], 'w') as f:
    f.write('\n'.join(redirects) + '\n')
print(len(redirects), 'redirects')
