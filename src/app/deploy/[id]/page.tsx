'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Heart,
  PowerOff,
  PlayCircle,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { Deployment, DeploymentVersion } from '@/lib/db';
import ConfirmDialog from '@/components/ConfirmDialog';
import Preview from '@/components/Preview';
import Toast from '@/components/Toast';
import { useLanguage } from '@/components/LanguageProvider';

type DeploymentWithVersions = Deployment & {
  versions?: DeploymentVersion[];
};

type SourceDialogState = {
  open: boolean;
  version: DeploymentVersion | null;
  content: string;
  draft: string;
  loading: boolean;
  saving: boolean;
};

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { language, isZh } = useLanguage();
  const router = useRouter();
  const htmlCacheRef = useRef<Map<string, string>>(new Map());

  const text = useMemo(
    () =>
      isZh
        ? {
            notFound: '部署不存在',
            fetchFailed: '获取部署详情失败',
            publish: '上架',
            unpublish: '下架',
            confirmAction: (action: string) => `确认${action}`,
            confirmActionMsg: (action: string, willUnpublish: boolean) =>
              `确定要${action}这个部署吗？${willUnpublish ? '下架后链接将暂时失效。' : '上架后链接将恢复访问。'}`,
            actionDone: (action: string) => `已${action}`,
            actionFailed: (action: string) => `${action}失败`,
            operationFailed: '操作失败',
            deleteTitle: '确认彻底删除',
            deleteMsg: '确定要彻底删除这个部署吗？删除后所有数据和文件将无法恢复！',
            deleted: '已删除该部署',
            detail: '部署详情',
            back: '返回商城',
            currentVersion: (version: number | string) => `当前版本 v${version}`,
            versionHistory: '版本历史',
            versions: (count: number) => `${count} 个版本`,
            views: (count: number) => `${count} 次访问`,
            likes: (count: number) => `${count} 个赞`,
            active: '运行中',
            inactive: '已下架',
            accessInfo: '访问信息',
            accessLink: '访问链接',
            qrCode: '二维码',
            qrcodeAlt: '部署二维码',
            downloadQrcode: '下载二维码',
            previewTitle: '当前版本预览',
            unpublishDeploy: '下架部署',
            deleteForever: '彻底删除',
            lockedByLike: '该项目已被点赞锁定，不能下架、上架或删除。',
            inactiveTipTitle: '该部署已下架',
            inactiveTipDesc: '链接已失效，如需恢复请点击重新上架',
            republish: '重新上架',
            openCurrent: '打开当前版本',
            openVersion: '打开该版本',
            copyLink: '复制链接',
            copySource: '复制源码',
            downloadHtml: '下载 HTML',
            viewEdit: '查看/编辑源码',
            switchCurrent: '设为当前版本',
            alreadyCurrent: '当前版本',
            sourceTitle: 'HTML 源码',
            loadingSource: '正在读取源码...',
            sourceCopied: '源码已复制到剪贴板',
            linkCopied: '链接已复制到剪贴板',
            copyFailed: '复制失败',
            downloadFailed: '下载失败',
            fetchContentFailed: '读取源码失败',
            saveAsNew: '保存为新版本',
            saveDone: '已保存为新版本',
            saveFailed: '保存新版本失败',
            switchDone: '已切换当前版本',
            switchFailed: '切换当前版本失败',
            emptyVersions: '暂无版本历史',
            descriptionFallback: '暂无简介',
          }
        : {
            notFound: 'Deployment not found',
            fetchFailed: 'Failed to load deployment details',
            publish: 'publish',
            unpublish: 'unpublish',
            confirmAction: (action: string) => `Confirm ${action}`,
            confirmActionMsg: (action: string, willUnpublish: boolean) =>
              `Are you sure you want to ${action} this deployment? ${
                willUnpublish
                  ? 'The link will be unavailable after unpublishing.'
                  : 'The link will be available again after publishing.'
              }`,
            actionDone: (action: string) => `${action} successful`,
            actionFailed: (action: string) => `${action} failed`,
            operationFailed: 'Operation failed',
            deleteTitle: 'Confirm permanent deletion',
            deleteMsg: 'Delete this deployment permanently? All data and files will be unrecoverable.',
            deleted: 'Deployment deleted',
            detail: 'Deployment Details',
            back: 'Back to marketplace',
            currentVersion: (version: number | string) => `Current v${version}`,
            versionHistory: 'Version History',
            versions: (count: number) => `${count} versions`,
            views: (count: number) => `${count} views`,
            likes: (count: number) => `${count} likes`,
            active: 'Active',
            inactive: 'Offline',
            accessInfo: 'Access Info',
            accessLink: 'Access URL',
            qrCode: 'QR Code',
            qrcodeAlt: 'Deployment QR code',
            downloadQrcode: 'Download QR Code',
            previewTitle: 'Current Version Preview',
            unpublishDeploy: 'Unpublish Deployment',
            deleteForever: 'Delete Permanently',
            lockedByLike: 'This project has likes and is locked from status changes or deletion.',
            inactiveTipTitle: 'This deployment is offline',
            inactiveTipDesc: 'The link is unavailable. Republish to restore access.',
            republish: 'Republish',
            openCurrent: 'Open current version',
            openVersion: 'Open this version',
            copyLink: 'Copy link',
            copySource: 'Copy source',
            downloadHtml: 'Download HTML',
            viewEdit: 'View/edit source',
            switchCurrent: 'Set as current',
            alreadyCurrent: 'Current version',
            sourceTitle: 'HTML Source',
            loadingSource: 'Loading source...',
            sourceCopied: 'Source copied to clipboard',
            linkCopied: 'Link copied to clipboard',
            copyFailed: 'Copy failed',
            downloadFailed: 'Download failed',
            fetchContentFailed: 'Failed to read source',
            saveAsNew: 'Save as new version',
            saveDone: 'Saved as a new version',
            saveFailed: 'Failed to save new version',
            switchDone: 'Current version switched',
            switchFailed: 'Failed to switch current version',
            emptyVersions: 'No version history yet',
            descriptionFallback: 'No description yet',
          },
    [isZh],
  );

  const [deploy, setDeploy] = useState<DeploymentWithVersions | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    type: 'info',
  });
  const [sourceDialog, setSourceDialog] = useState<SourceDialogState>({
    open: false,
    version: null,
    content: '',
    draft: '',
    loading: false,
    saving: false,
  });
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'danger' | 'warning' | 'info';
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'warning',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, type });
  };

  const fetchDeploy = useCallback(async (targetId: string) => {
    const res = await fetch(`/api/deploy/${targetId}`);
    if (!res.ok) {
      throw new Error(text.notFound);
    }
    const data = await res.json();
    setDeploy(data);
  }, [text.notFound]);

  useEffect(() => {
    const unwrapParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    unwrapParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        await fetchDeploy(id);
      } catch (error) {
        console.error('Fetch error', error);
        showToast(text.fetchFailed, 'error');
        router.push('/deploy');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchDeploy, id, router, text.fetchFailed]);

  const versions = useMemo(() => deploy?.versions || [], [deploy?.versions]);
  const currentVersion = useMemo(() => {
    if (!deploy) return null;
    return versions.find((version) => version.id === deploy.currentVersionId) || versions[0] || null;
  }, [deploy, versions]);

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const showDialog = (
    type: 'danger' | 'warning' | 'info',
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    setDialogState({
      isOpen: true,
      type,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        closeDialog();
      },
    });
  };

  const getVersionUrl = useCallback((version?: DeploymentVersion | null) => {
    if (!deploy) return '';
    const origin = window.location.origin;
    if (!version) {
      return `${origin}/s/${deploy.code}`;
    }
    return `${origin}/s/${deploy.code}/v/${version.versionNumber}`;
  }, [deploy]);

  const fetchVersionHtml = useCallback(async (version: DeploymentVersion) => {
    if (!deploy) throw new Error(text.fetchContentFailed);
    const cacheKey = `${deploy.code}:${version.versionNumber}`;
    const cachedHtml = htmlCacheRef.current.get(cacheKey);
    if (cachedHtml) return cachedHtml;

    const params = new URLSearchParams({
      code: deploy.code,
      version: String(version.versionNumber),
    });
    const res = await fetch(`/api/deploy/content?${params.toString()}`);
    if (!res.ok) {
      throw new Error(text.fetchContentFailed);
    }

    const data = await res.json();
    if (!data.success || typeof data.content !== 'string') {
      throw new Error(data.error || text.fetchContentFailed);
    }

    htmlCacheRef.current.set(cacheKey, data.content);
    return data.content;
  }, [deploy, text.fetchContentFailed]);

  const handleToggleStatus = () => {
    if (!deploy) return;
    if (deploy.likeCount > 0) {
      showToast(text.lockedByLike, 'info');
      return;
    }
    const newStatus = deploy.status === 'active' ? 'inactive' : 'active';
    const actionName = newStatus === 'active' ? text.publish : text.unpublish;

    showDialog(
      newStatus === 'inactive' ? 'warning' : 'info',
      text.confirmAction(actionName),
      text.confirmActionMsg(actionName, newStatus === 'inactive'),
      async () => {
        try {
          const res = await fetch(`/api/deploy/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          if (res.ok) {
            showToast(text.actionDone(actionName), 'success');
            await fetchDeploy(id);
          } else {
            showToast(text.actionFailed(actionName), 'error');
          }
        } catch (error) {
          console.error('Toggle status error', error);
          showToast(text.operationFailed, 'error');
        }
      },
    );
  };

  const handleDelete = () => {
    if (deploy && deploy.likeCount > 0) {
      showToast(text.lockedByLike, 'info');
      return;
    }

    showDialog('danger', text.deleteTitle, text.deleteMsg, async () => {
      try {
        const res = await fetch(`/api/deploy/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          showToast(text.deleted, 'success');
          router.push('/deploy');
        } else {
          showToast(text.actionFailed(text.deleteForever), 'error');
        }
      } catch (error) {
        console.error('Delete error', error);
        showToast(text.operationFailed, 'error');
      }
    });
  };

  const handleCopyLink = async (version?: DeploymentVersion | null) => {
    try {
      await navigator.clipboard.writeText(getVersionUrl(version));
      setCopiedKey(`link-${version?.id || 'current'}`);
      showToast(text.linkCopied, 'success');
      setTimeout(() => setCopiedKey(null), 1600);
    } catch (error) {
      console.error('Copy link error', error);
      showToast(text.copyFailed, 'error');
    }
  };

  const handleCopySource = async (version: DeploymentVersion) => {
    try {
      const html = await fetchVersionHtml(version);
      await navigator.clipboard.writeText(html);
      setCopiedKey(`source-${version.id}`);
      showToast(text.sourceCopied, 'success');
      setTimeout(() => setCopiedKey(null), 1600);
    } catch (error) {
      console.error('Copy source error', error);
      showToast(text.copyFailed, 'error');
    }
  };

  const handleDownload = async (version: DeploymentVersion) => {
    try {
      const html = await fetchVersionHtml(version);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = version.filename || `${deploy?.code || 'deploy'}-v${version.versionNumber}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error', error);
      showToast(text.downloadFailed, 'error');
    }
  };

  const handleOpenSource = async (version: DeploymentVersion) => {
    setSourceDialog({
      open: true,
      version,
      content: '',
      draft: '',
      loading: true,
      saving: false,
    });

    try {
      const html = await fetchVersionHtml(version);
      setSourceDialog({
        open: true,
        version,
        content: html,
        draft: html,
        loading: false,
        saving: false,
      });
    } catch (error) {
      console.error('View source error', error);
      setSourceDialog((current) => ({ ...current, loading: false }));
      showToast(text.fetchContentFailed, 'error');
    }
  };

  const handleSwitchVersion = async (version: DeploymentVersion) => {
    if (!deploy || version.id === deploy.currentVersionId) return;
    try {
      const res = await fetch(`/api/deploys/${deploy.code}/current`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: version.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || text.switchFailed);
      }
      showToast(text.switchDone, 'success');
      await fetchDeploy(id);
    } catch (error) {
      console.error('Switch version error', error);
      showToast(text.switchFailed, 'error');
    }
  };

  const handleSaveSourceAsNewVersion = async () => {
    if (!deploy || !sourceDialog.version) return;
    setSourceDialog((current) => ({ ...current, saving: true }));
    try {
      const res = await fetch('/api/deploy/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: deploy.code,
          content: sourceDialog.draft,
          title: sourceDialog.version.title || deploy.title,
          description: sourceDialog.version.description ?? deploy.description ?? '',
          filename: sourceDialog.version.filename,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || text.saveFailed);
      }

      htmlCacheRef.current.clear();
      showToast(text.saveDone, 'success');
      setSourceDialog({
        open: false,
        version: null,
        content: '',
        draft: '',
        loading: false,
        saving: false,
      });
      await fetchDeploy(id);
    } catch (error) {
      console.error('Save source error', error);
      setSourceDialog((current) => ({ ...current, saving: false }));
      showToast(text.saveFailed, 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-600" />
      </div>
    );
  }

  if (!deploy) return null;

  const fullUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/s/${deploy.code}`;
  const currentVersionNumber = currentVersion?.versionNumber || 1;
  const canUseLivePreview = deploy.status === 'active';

  return (
    <div className="space-y-6 pb-8">
      <Toast
        isOpen={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
      />
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={dialogState.onConfirm}
        onCancel={closeDialog}
      />

      {sourceDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-400">{text.sourceTitle}</p>
                <h3 className="truncate text-lg font-semibold text-slate-900">
                  v{sourceDialog.version?.versionNumber} · {sourceDialog.version?.filename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSourceDialog({ open: false, version: null, content: '', draft: '', loading: false, saving: false })}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sourceDialog.loading ? (
              <div className="flex min-h-[440px] items-center justify-center bg-slate-950 text-sm text-slate-100">
                {text.loadingSource}
              </div>
            ) : (
              <textarea
                value={sourceDialog.draft}
                onChange={(event) => setSourceDialog((current) => ({ ...current, draft: event.target.value }))}
                className="min-h-[520px] flex-1 resize-none bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-100 outline-none"
                spellCheck={false}
              />
            )}
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">{formatFileSize(sourceDialog.version?.fileSize)}</div>
              <div className="flex flex-wrap justify-end gap-2">
                {sourceDialog.version && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopySource(sourceDialog.version as DeploymentVersion)}
                      className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {text.copySource}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(sourceDialog.version as DeploymentVersion)}
                      className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {text.downloadHtml}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSaveSourceAsNewVersion}
                  disabled={sourceDialog.loading || sourceDialog.saving || !sourceDialog.draft.trim()}
                  className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {sourceDialog.saving ? text.loadingSource : text.saveAsNew}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <Link href="/deploy" className="mb-3 inline-flex items-center text-sm font-medium text-slate-500 hover:text-sky-700">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {text.back}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-bold text-slate-900">{deploy.title}</h1>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              {text.currentVersion(currentVersionNumber)}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                deploy.status === 'active'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              {deploy.status === 'active' ? text.active : text.inactive}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{deploy.description || text.descriptionFallback}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center">
              <Calendar className="mr-1.5 h-4 w-4" />
              {formatDate(deploy.createdAt)}
            </span>
            <span className="inline-flex items-center">
              <Eye className="mr-1.5 h-4 w-4" />
              {text.views(deploy.viewCount)}
            </span>
            <span className="inline-flex items-center">
              <Heart className="mr-1.5 h-4 w-4" />
              {text.likes(deploy.likeCount)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUseLivePreview && (
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {text.openCurrent}
            </a>
          )}
          <button
            type="button"
            onClick={() => handleCopyLink(null)}
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copiedKey === 'link-current' ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {text.copyLink}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{text.accessInfo}</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-600">{text.accessLink}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={fullUrl}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600 text-white transition hover:bg-sky-700"
                    title={text.copyLink}
                  >
                    {copiedKey === 'link-current' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                {canUseLivePreview && (
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center text-sm font-medium text-sky-700 hover:text-sky-900"
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    {text.openCurrent}
                  </a>
                )}
              </div>

              <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="mb-3 text-sm font-semibold text-slate-600">{text.qrCode}</p>
                {deploy.qrCodePath ? (
                  <>
                    <div className="rounded-lg bg-white p-2 shadow-sm">
                      <img src={deploy.qrCodePath} alt={text.qrcodeAlt} className="h-32 w-32" />
                    </div>
                    <a
                      href={deploy.qrCodePath}
                      download={`qrcode-${deploy.code}.png`}
                      className="mt-3 text-sm font-medium text-sky-700 hover:text-sky-900"
                    >
                      {text.downloadQrcode}
                    </a>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">-</span>
                )}
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{text.previewTitle}</h2>
            <span className="text-sm text-slate-500">{formatFileSize(deploy.fileSize)}</span>
          </div>
          {canUseLivePreview ? (
            <Preview url={fullUrl} />
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">
              <PowerOff className="mb-3 h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-500">{text.inactiveTipTitle}</p>
              <p className="mt-1 text-sm text-slate-400">{text.inactiveTipDesc}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              onClick={handleToggleStatus}
              disabled={deploy.likeCount > 0}
              className={`inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                deploy.status === 'active'
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}
              title={deploy.likeCount > 0 ? text.lockedByLike : undefined}
            >
              {deploy.status === 'active' ? <PowerOff className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              {deploy.status === 'active' ? text.unpublishDeploy : text.republish}
            </button>

            <button
              onClick={handleDelete}
              disabled={deploy.likeCount > 0}
              className="inline-flex items-center rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              title={deploy.likeCount > 0 ? text.lockedByLike : undefined}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {text.deleteForever}
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{text.versionHistory}</h2>
              <p className="text-xs text-slate-500">{text.versions(versions.length)}</p>
            </div>
            <Code2 className="h-5 w-5 text-slate-400" />
          </div>

          {versions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              {text.emptyVersions}
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const isCurrent = version.id === deploy.currentVersionId;
                return (
                  <div
                    key={version.id}
                    className={`rounded-xl border p-3 transition ${
                      isCurrent
                        ? 'border-sky-200 bg-sky-50/80 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">v{version.versionNumber}</p>
                          {isCurrent && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {text.alreadyCurrent}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {version.description || version.title || version.filename}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">{formatDate(version.createdAt)}</p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{formatFileSize(version.fileSize)}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <a
                        href={getVersionUrl(version)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-sky-600"
                        title={text.openVersion}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(version)}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-sky-600"
                        title={text.copyLink}
                      >
                        {copiedKey === `link-${version.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(version)}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-sky-600"
                        title={text.downloadHtml}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopySource(version)}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-indigo-600"
                        title={text.copySource}
                      >
                        {copiedKey === `source-${version.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenSource(version)}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-violet-600"
                        title={text.viewEdit}
                      >
                        <Code2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchVersion(version)}
                        disabled={isCurrent}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-emerald-600 disabled:cursor-not-allowed disabled:text-slate-300"
                        title={isCurrent ? text.alreadyCurrent : text.switchCurrent}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
