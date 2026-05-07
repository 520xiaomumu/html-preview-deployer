'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
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
            versionLikes: (count: number) => `${count} 赞`,
            active: '运行中',
            inactive: '已下架',
            primaryVersionRule: '主域名由最高赞版本决定',
            primaryVersion: '主版本',
            qrcodeAlt: '部署二维码',
            downloadQrcode: '下载二维码',
            previewTitle: (version: number | string) => `v${version} 预览`,
            unpublishDeploy: '下架部署',
            deleteForever: '彻底删除',
            lockedByLike: '该项目已被点赞锁定，不能下架、上架或删除。',
            likePrimary: '点赞主域名当前版本',
            unlikePrimary: '取消主版本点赞',
            likeVersion: '点赞该版本',
            unlikeVersion: '取消该版本点赞',
            likeDone: '已点赞版本，主域名会自动指向最高赞版本',
            unlikeDone: '已取消点赞',
            likeFailed: '点赞失败',
            unlikeFailed: '取消点赞失败',
            inactiveTipTitle: '该部署已下架',
            inactiveTipDesc: '链接已失效，如需恢复请点击重新上架',
            republish: '重新上架',
            openCurrent: '打开当前版本',
            openVersion: '打开该版本',
            copyLink: '复制链接',
            copyQrcode: '复制二维码',
            copySource: '复制源码',
            downloadHtml: '下载 HTML',
            viewEdit: '查看/编辑源码',
            switchCurrent: '设为当前版本',
            alreadyCurrent: '当前版本',
            sourceTitle: 'HTML 源码',
            loadingSource: '正在读取源码...',
            sourceCopied: '源码已复制到剪贴板',
            linkCopied: '链接已复制到剪贴板',
            qrcodeCopied: '二维码已复制到剪贴板',
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
            versionLikes: (count: number) => `${count} likes`,
            active: 'Active',
            inactive: 'Offline',
            primaryVersionRule: 'The main URL follows the most-liked version',
            primaryVersion: 'Main version',
            qrcodeAlt: 'Deployment QR code',
            downloadQrcode: 'Download QR Code',
            previewTitle: (version: number | string) => `v${version} Preview`,
            unpublishDeploy: 'Unpublish Deployment',
            deleteForever: 'Delete Permanently',
            lockedByLike: 'This project has likes and is locked from status changes or deletion.',
            likePrimary: 'Like the current main version',
            unlikePrimary: 'Remove main-version like',
            likeVersion: 'Like this version',
            unlikeVersion: 'Remove this version like',
            likeDone: 'Version liked. The main URL follows the most-liked version.',
            unlikeDone: 'Like removed',
            likeFailed: 'Failed to like',
            unlikeFailed: 'Failed to remove like',
            inactiveTipTitle: 'This deployment is offline',
            inactiveTipDesc: 'The link is unavailable. Republish to restore access.',
            republish: 'Republish',
            openCurrent: 'Open current version',
            openVersion: 'Open this version',
            copyLink: 'Copy link',
            copyQrcode: 'Copy QR code',
            copySource: 'Copy source',
            downloadHtml: 'Download HTML',
            viewEdit: 'View/edit source',
            switchCurrent: 'Set as current',
            alreadyCurrent: 'Current version',
            sourceTitle: 'HTML Source',
            loadingSource: 'Loading source...',
            sourceCopied: 'Source copied to clipboard',
            linkCopied: 'Link copied to clipboard',
            qrcodeCopied: 'QR code copied to clipboard',
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
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [likedVersionIds, setLikedVersionIds] = useState<Set<string>>(new Set());
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
  const primaryVersion = useMemo(() => {
    if (!deploy) return null;
    return versions.find((version) => version.id === deploy.primaryVersionId)
      || versions
        .filter((version) => version.likeCount > 0)
        .sort((a, b) => b.likeCount - a.likeCount || b.versionNumber - a.versionNumber)[0]
      || currentVersion
      || versions[0]
      || null;
  }, [currentVersion, deploy, versions]);
  const selectedVersion = useMemo(() => {
    if (!deploy) return null;
    return versions.find((version) => version.id === selectedVersionId)
      || primaryVersion
      || currentVersion
      || versions[0]
      || null;
  }, [currentVersion, deploy, primaryVersion, selectedVersionId, versions]);

  useEffect(() => {
    if (!primaryVersion) return;
    setSelectedVersionId((previous) => {
      if (previous && versions.some((version) => version.id === previous)) {
        return previous;
      }
      return primaryVersion.id;
    });
  }, [primaryVersion, versions]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('htmlcode-liked-deployment-versions');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setLikedVersionIds(new Set(parsed.filter((item): item is string => typeof item === 'string')));
        }
      }
    } catch {
      setLikedVersionIds(new Set());
    }
  }, []);

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

  const getVersionSuffix = useCallback((version?: DeploymentVersion | null) => {
    if (!deploy) return '';
    if (!version) return deploy.code;
    return `${deploy.code}/v/${version.versionNumber}`;
  }, [deploy]);

  const getPreviewUrl = useCallback((version?: DeploymentVersion | null) => {
    const versionUrl = getVersionUrl(version);
    if (!versionUrl) return '';
    return `${versionUrl}?preview=1`;
  }, [getVersionUrl]);

  useEffect(() => {
    let cancelled = false;

    const generateQrcodes = async () => {
      if (!deploy || versions.length === 0 || typeof window === 'undefined') return;

      const missingVersions = versions.filter((version) => !qrCodeUrls[version.id]);
      if (missingVersions.length === 0) return;

      const generatedEntries = await Promise.all(
        missingVersions.map(async (version) => {
          const dataUrl = await QRCode.toDataURL(getVersionUrl(version), {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 116,
          });
          return [version.id, dataUrl] as const;
        }),
      );

      if (!cancelled) {
        setQrCodeUrls((current) => ({
          ...current,
          ...Object.fromEntries(generatedEntries),
        }));
      }
    };

    generateQrcodes().catch((error) => {
      console.error('Generate QR code error', error);
    });

    return () => {
      cancelled = true;
    };
  }, [deploy, getVersionUrl, qrCodeUrls, versions]);

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

  const handleCopyQrcode = async (version: DeploymentVersion) => {
    try {
      const qrCodeUrl = qrCodeUrls[version.id] || await QRCode.toDataURL(getVersionUrl(version), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
      });

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        const blob = await (await fetch(qrCodeUrl)).blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
        setCopiedKey(`qr-${version.id}`);
        showToast(text.qrcodeCopied, 'success');
      } else {
        await navigator.clipboard.writeText(getVersionUrl(version));
        setCopiedKey(`link-${version.id}`);
        showToast(text.linkCopied, 'success');
      }
      setTimeout(() => setCopiedKey(null), 1600);
    } catch (error) {
      console.error('Copy QR code error', error);
      showToast(text.copyFailed, 'error');
    }
  };

  const persistLikedVersionIds = (nextLikedIds: Set<string>) => {
    setLikedVersionIds(nextLikedIds);
    window.localStorage.setItem('htmlcode-liked-deployment-versions', JSON.stringify(Array.from(nextLikedIds)));
  };

  const handleLikeVersion = async (version: DeploymentVersion, useDeploymentEndpoint = false) => {
    if (!deploy || deploy.status !== 'active') return;
    const alreadyLiked = likedVersionIds.has(version.id);
    try {
      const res = await fetch(
        useDeploymentEndpoint
          ? `/api/deploy/${deploy.id}/like`
          : `/api/deploys/${deploy.code}/versions/${version.versionNumber}/like`,
        { method: alreadyLiked ? 'DELETE' : 'POST' },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (alreadyLiked ? text.unlikeFailed : text.likeFailed));
      }

      const resolvedVersionId = typeof data.versionId === 'string' ? data.versionId : version.id;
      const nextLikedIds = new Set(likedVersionIds);
      if (alreadyLiked) {
        nextLikedIds.delete(resolvedVersionId);
      } else {
        nextLikedIds.add(resolvedVersionId);
      }
      persistLikedVersionIds(nextLikedIds);
      showToast(alreadyLiked ? text.unlikeDone : text.likeDone, 'success');
      await fetchDeploy(id);
    } catch (error) {
      console.error('Like version error', error);
      showToast(alreadyLiked ? text.unlikeFailed : text.likeFailed, 'error');
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
          description: sourceDialog.version.description || deploy.description || sourceDialog.version.title || deploy.title,
          filename: sourceDialog.version.filename,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || text.saveFailed);
      }

      htmlCacheRef.current.clear();
      setSelectedVersionId(null);
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
  const selectedVersionNumber = selectedVersion?.versionNumber || currentVersionNumber;
  const selectedPreviewUrl = selectedVersion ? getPreviewUrl(selectedVersion) : `${fullUrl}?preview=1`;
  const canUseLivePreview = deploy.status === 'active';
  const primaryVersionNumber = primaryVersion?.versionNumber || currentVersionNumber;

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
            {primaryVersion && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {text.primaryVersion} v{primaryVersionNumber}
              </span>
            )}
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
          <p className="mt-2 text-xs text-slate-400">{text.primaryVersionRule}</p>
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
            {primaryVersion && (
              <button
                type="button"
                onClick={() => handleLikeVersion(primaryVersion, true)}
                className={`inline-flex items-center transition ${
                  likedVersionIds.has(primaryVersion.id) ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
                }`}
                title={likedVersionIds.has(primaryVersion.id) ? text.unlikePrimary : text.likePrimary}
              >
                <Heart className={`mr-1.5 h-4 w-4 ${likedVersionIds.has(primaryVersion.id) ? 'fill-current' : ''}`} />
                {text.versionLikes(primaryVersion.likeCount)}
              </button>
            )}
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{text.previewTitle(selectedVersionNumber)}</h2>
            <span className="text-sm text-slate-500">{formatFileSize(selectedVersion?.fileSize ?? deploy.fileSize)}</span>
          </div>
          {selectedPreviewUrl ? (
            <Preview url={selectedPreviewUrl} />
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
                const isPrimary = version.id === primaryVersion?.id;
                const isSelected = version.id === selectedVersion?.id;
                const publicVersionUrl = getVersionUrl(version);
                const publicVersionSuffix = getVersionSuffix(version);
                return (
                  <div
                    key={version.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedVersionId(version.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedVersionId(version.id);
                      }
                    }}
                    className={`rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-sky-300 bg-sky-50/90 shadow-sm'
                        : isCurrent
                          ? 'border-emerald-200 bg-emerald-50/60'
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
                          {isPrimary && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                              {text.primaryVersion}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {version.description || version.title || version.filename}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">{formatDate(version.createdAt)}</p>
                        <p className="mt-1 inline-flex items-center text-xs text-slate-400">
                          <Heart className="mr-1 h-3.5 w-3.5" />
                          {text.versionLikes(version.likeCount)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{formatFileSize(version.fileSize)}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white/75 p-2">
                      <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-sm">
                        {qrCodeUrls[version.id] ? (
                          <img src={qrCodeUrls[version.id]} alt={text.qrcodeAlt} className="h-full w-full" />
                        ) : (
                          <span className="text-xs text-slate-300">QR</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-600" title={publicVersionUrl}>
                          {publicVersionSuffix}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleLikeVersion(version);
                            }}
                            className={`rounded-md p-2 transition ${
                              likedVersionIds.has(version.id)
                                ? 'text-rose-500'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-rose-500'
                            }`}
                            title={likedVersionIds.has(version.id) ? text.unlikeVersion : text.likeVersion}
                          >
                            <Heart className={`h-4 w-4 ${likedVersionIds.has(version.id) ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCopyQrcode(version);
                            }}
                            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-50 hover:text-sky-600"
                            title={text.copyQrcode}
                          >
                            {copiedKey === `qr-${version.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                          {qrCodeUrls[version.id] && (
                            <a
                              href={qrCodeUrls[version.id]}
                              download={`qrcode-${deploy.code}-v${version.versionNumber}.png`}
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-50 hover:text-sky-600"
                              title={text.downloadQrcode}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <a
                        href={getVersionUrl(version)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-sky-600"
                        title={text.openVersion}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCopyLink(version);
                        }}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-sky-600"
                        title={text.copyLink}
                      >
                        {copiedKey === `link-${version.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownload(version);
                        }}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-sky-600"
                        title={text.downloadHtml}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCopySource(version);
                        }}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-indigo-600"
                        title={text.copySource}
                      >
                        {copiedKey === `source-${version.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenSource(version);
                        }}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-white hover:text-violet-600"
                        title={text.viewEdit}
                      >
                        <Code2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleSwitchVersion(version);
                        }}
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
