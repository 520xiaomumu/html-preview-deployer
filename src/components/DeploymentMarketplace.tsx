'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Trash2,
  Eye,
  Calendar,
  ExternalLink,
  PowerOff,
  PlayCircle,
  Download,
  Copy,
  Check,
  HardDrive,
  Search,
  Heart,
  Code2,
  X,
} from 'lucide-react';
import { Deployment } from '@/lib/db';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast from '@/components/Toast';
import { useLanguage } from '@/components/LanguageProvider';

interface DeploymentMarketplaceProps {
  title?: string;
  subtitle?: string;
}

type SortBy = 'latest' | 'oldest' | 'mostViewed' | 'leastViewed' | 'mostLiked' | 'leastLiked';

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FileSizeInfo({
  size,
  tooltip,
}: {
  size: number | null | undefined;
  tooltip: string;
}) {
  const formattedSize = formatFileSize(size);

  if (!formattedSize) return null;
  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
      title={tooltip}
    >
      <HardDrive className="mr-1 h-3.5 w-3.5" />
      {formattedSize}
    </div>
  );
}

export default function DeploymentMarketplace({
  title,
  subtitle,
}: DeploymentMarketplaceProps) {
  const { isZh, language } = useLanguage();
  const text = useMemo(
    () =>
      isZh
        ? {
            defaultTitle: '应用商城',
            searchPlaceholder: '搜索标题、文件名或部署码',
            sortLatest: '按时间: 最新优先',
            sortOldest: '按时间: 最早优先',
            sortMostViewed: '按访问量: 从高到低',
            sortLeastViewed: '按访问量: 从低到高',
            sortMostLiked: '按点赞数: 从高到低',
            sortLeastLiked: '按点赞数: 从低到高',
            filterAll: '全部状态',
            filterActive: '运行中',
            filterInactive: '已下架',
            totalApps: (count: number) => `共 ${count} 个上线应用`,
            refreshing: '正在更新列表...',
            emptyState: '暂无部署记录',
            emptyAction: '去手动部署第一个页面',
            fetchListFailed: '获取部署列表失败，请稍后重试',
            fetchListFailedShort: '获取部署列表失败',
            fetchContentFailed: '获取内容失败',
            loadingSource: '正在读取源码...',
            uploadAction: '上架',
            offlineAction: '下架',
            confirmAction: (action: string) => `确认${action}`,
            confirmActionMessage: (action: string, willOffline: boolean) =>
              `确定要${action}这个部署吗？${willOffline ? '下架后链接将暂时失效。' : '上架后链接将恢复访问。'}`,
            actionDone: (action: string) => `已${action}`,
            actionFailed: (action: string) => `${action}失败`,
            operationFailed: '操作失败',
            deleteTitle: '确认彻底删除',
            deleteMessage: '确定要彻底删除这个部署吗？删除后所有数据和文件将无法恢复！',
            deleted: '已删除该部署',
            downloadFailed: '下载失败',
            copySuccess: '源码已复制到剪贴板',
            copyFailed: '复制失败',
            likeSuccess: '点赞成功，项目内容已锁定',
            likeFailed: '点赞失败',
            unlikeSuccess: '已取消点赞',
            unlikeFailed: '取消点赞失败',
            fileSizeTooltip: 'HTML 文件大小',
            previewLabel: '预览',
            previewOpen: '打开预览',
            previewOpenTitle: '在新标签页中打开完整预览',
            previewTip: '可直接拖动右侧滚动条查看完整页面，或点击右上角进入完整预览',
            projectOffline: '项目已下架',
            projectOfflineTip: '重新上架后可恢复预览',
            shortCode: '短链后缀',
            addressTitle: (code: string) => `访问地址: /s/${code}`,
            views: (count: number) => `${count} 次访问`,
            likes: (count: number) => `${count} 个赞`,
            detailTitle: '查看详情',
            likeProject: '点赞并锁定项目',
            likedProject: '取消点赞',
            lockedProject: '已被点赞锁定，不能修改或删除',
            downloadHtml: '下载 HTML 文件',
            copyCode: '复制代码',
            viewCode: '查看代码',
            sourceTitle: 'HTML 源码',
            descriptionFallback: '暂无简介',
            putOffline: '下架',
            relaunch: '上架',
            deleteForever: '彻底删除',
            pageText: (page: number, totalPage: number, totalCount: number) =>
              `第 ${page} / ${totalPage} 页，共 ${totalCount} 条`,
            prevPage: '上一页',
            nextPage: '下一页',
          }
        : {
            defaultTitle: 'Marketplace',
            searchPlaceholder: 'Search title, filename, or deployment code',
            sortLatest: 'Sort by time: newest first',
            sortOldest: 'Sort by time: oldest first',
            sortMostViewed: 'Sort by views: high to low',
            sortLeastViewed: 'Sort by views: low to high',
            sortMostLiked: 'Sort by likes: high to low',
            sortLeastLiked: 'Sort by likes: low to high',
            filterAll: 'All statuses',
            filterActive: 'Active',
            filterInactive: 'Offline',
            totalApps: (count: number) => `${count} apps online`,
            refreshing: 'Refreshing list...',
            emptyState: 'No deployments yet',
            emptyAction: 'Deploy your first page',
            fetchListFailed: 'Failed to fetch deployments, please try again later',
            fetchListFailedShort: 'Failed to fetch deployments',
            fetchContentFailed: 'Failed to load content',
            loadingSource: 'Loading source...',
            uploadAction: 'publish',
            offlineAction: 'unpublish',
            confirmAction: (action: string) => `Confirm ${action}`,
            confirmActionMessage: (action: string, willOffline: boolean) =>
              `Are you sure you want to ${action} this deployment? ${
                willOffline
                  ? 'The link will be unavailable after unpublishing.'
                  : 'The link will be available again after publishing.'
              }`,
            actionDone: (action: string) => `${action} successful`,
            actionFailed: (action: string) => `${action} failed`,
            operationFailed: 'Operation failed',
            deleteTitle: 'Confirm permanent deletion',
            deleteMessage: 'Delete this deployment permanently? All data and files will be unrecoverable.',
            deleted: 'Deployment deleted',
            downloadFailed: 'Download failed',
            copySuccess: 'Source copied to clipboard',
            copyFailed: 'Copy failed',
            likeSuccess: 'Liked. This project is now locked.',
            likeFailed: 'Failed to like',
            unlikeSuccess: 'Like removed',
            unlikeFailed: 'Failed to remove like',
            fileSizeTooltip: 'HTML file size',
            previewLabel: 'Preview',
            previewOpen: 'Open Preview',
            previewOpenTitle: 'Open full preview in a new tab',
            previewTip: 'You can scroll to view the full page or open the full preview from the top-right button.',
            projectOffline: 'Project offline',
            projectOfflineTip: 'Preview will return after republishing',
            shortCode: 'Short code',
            addressTitle: (code: string) => `URL: /s/${code}`,
            views: (count: number) => `${count} views`,
            likes: (count: number) => `${count} likes`,
            detailTitle: 'View details',
            likeProject: 'Like and lock project',
            likedProject: 'Remove like',
            lockedProject: 'Locked by likes. It cannot be changed or deleted.',
            downloadHtml: 'Download HTML',
            copyCode: 'Copy source',
            viewCode: 'View source',
            sourceTitle: 'HTML Source',
            descriptionFallback: 'No description yet',
            putOffline: 'Unpublish',
            relaunch: 'Publish',
            deleteForever: 'Delete permanently',
            pageText: (page: number, totalPage: number, totalCount: number) =>
              `Page ${page} / ${totalPage}, total ${totalCount}`,
            prevPage: 'Previous',
            nextPage: 'Next',
          },
    [isZh],
  );
  const resolvedTitle = title ?? text.defaultTitle;
  const resolvedSubtitle = subtitle ?? '';

  const [deploys, setDeploys] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('latest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 12;
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    type: 'info',
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [sourceDialog, setSourceDialog] = useState<{
    open: boolean;
    title: string;
    content: string;
    loading: boolean;
  }>({
    open: false,
    title: '',
    content: '',
    loading: false,
  });
  const htmlCacheRef = useRef<Map<string, string>>(new Map());

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, type });
  };

  const fetchDeploys = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
      });

      if (filter !== 'all') {
        params.set('status', filter);
      }

      if (searchTerm.trim()) {
        params.set('q', searchTerm.trim());
      }

      const res = await fetch(`/api/deploys?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || text.fetchListFailedShort);
      }
      setDeploys(data.deploys || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch deploys', error);
      showToast(text.fetchListFailed, 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [filter, page, searchTerm, sortBy, text]);

  useEffect(() => {
    fetchDeploys();
  }, [fetchDeploys]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('htmlcode-liked-deployments');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setLikedIds(new Set(parsed.filter((item): item is string => typeof item === 'string')));
        }
      }
    } catch {
      setLikedIds(new Set());
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filter, searchTerm, sortBy]);

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const showDialog = (
    type: 'danger' | 'warning' | 'info',
    nextTitle: string,
    message: string,
    onConfirm: () => void,
  ) => {
    setDialogState({
      isOpen: true,
      type,
      title: nextTitle,
      message,
      onConfirm: () => {
        onConfirm();
        closeDialog();
      },
    });
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionName = newStatus === 'active' ? text.uploadAction : text.offlineAction;

    showDialog(
      newStatus === 'inactive' ? 'warning' : 'info',
      text.confirmAction(actionName),
      text.confirmActionMessage(actionName, newStatus === 'inactive'),
      async () => {
        try {
          const res = await fetch(`/api/deploy/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          if (res.ok) {
            fetchDeploys();
            showToast(text.actionDone(actionName), 'success');
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

  const handleDelete = (id: string) => {
    showDialog('danger', text.deleteTitle, text.deleteMessage, async () => {
      try {
        const res = await fetch(`/api/deploy/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchDeploys();
          showToast(text.deleted, 'success');
        } else {
          showToast(text.actionFailed(text.deleteForever), 'error');
        }
      } catch (error) {
        console.error('Delete error', error);
        showToast(text.operationFailed, 'error');
      }
    });
  };

  const fetchDeploymentHtml = useCallback(async (deploy: Deployment) => {
    const cachedHtml = htmlCacheRef.current.get(deploy.code);
    if (cachedHtml) {
      return cachedHtml;
    }

    const res = await fetch(`/api/deploy/content?code=${encodeURIComponent(deploy.code)}`);
    if (!res.ok) {
      throw new Error(text.fetchContentFailed);
    }

    const data = await res.json();
    if (!data.success || typeof data.content !== 'string') {
      throw new Error(data.error || text.fetchContentFailed);
    }

    htmlCacheRef.current.set(deploy.code, data.content);
    return data.content;
  }, [text.fetchContentFailed]);

  const handleDownload = useCallback(
    async (deploy: Deployment) => {
      try {
        const html = await fetchDeploymentHtml(deploy);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = deploy.filename || `${deploy.code}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download error', error);
        showToast(text.downloadFailed, 'error');
      }
    },
    [fetchDeploymentHtml, text.downloadFailed],
  );

  const handleCopyCode = useCallback(
    async (deploy: Deployment) => {
      try {
        const html = await fetchDeploymentHtml(deploy);
        await navigator.clipboard.writeText(html);
        setCopiedId(deploy.id);
        showToast(text.copySuccess, 'success');
        setTimeout(() => setCopiedId(null), 2000);
      } catch (error) {
        console.error('Copy error', error);
        showToast(text.copyFailed, 'error');
      }
    },
    [fetchDeploymentHtml, text.copyFailed, text.copySuccess],
  );

  const handleViewCode = useCallback(
    async (deploy: Deployment) => {
      setSourceDialog({
        open: true,
        title: deploy.title,
        content: '',
        loading: true,
      });

      try {
        const html = await fetchDeploymentHtml(deploy);
        setSourceDialog({
          open: true,
          title: deploy.title,
          content: html,
          loading: false,
        });
      } catch (error) {
        console.error('View source error', error);
        setSourceDialog((current) => ({ ...current, loading: false }));
        showToast(text.fetchContentFailed, 'error');
      }
    },
    [fetchDeploymentHtml, text.fetchContentFailed],
  );

  const persistLikedIds = (nextLikedIds: Set<string>) => {
    setLikedIds(nextLikedIds);
    window.localStorage.setItem('htmlcode-liked-deployments', JSON.stringify(Array.from(nextLikedIds)));
  };

  const handleLike = useCallback(
    async (deploy: Deployment) => {
      if (deploy.status !== 'active') return;

      const alreadyLiked = likedIds.has(deploy.id);

      try {
        const res = await fetch(`/api/deploy/${deploy.id}/like`, {
          method: alreadyLiked ? 'DELETE' : 'POST',
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || (alreadyLiked ? text.unlikeFailed : text.likeFailed));
        }

        setDeploys((current) =>
          current.map((item) =>
            item.id === deploy.id
              ? {
                  ...item,
                  likeCount: Number(
                    data.likeCount ?? (alreadyLiked ? Math.max(item.likeCount - 1, 0) : item.likeCount + 1),
                  ),
                }
              : item,
          ),
        );

        const nextLikedIds = new Set(likedIds);
        if (alreadyLiked) {
          nextLikedIds.delete(deploy.id);
        } else {
          nextLikedIds.add(deploy.id);
        }
        persistLikedIds(nextLikedIds);
        showToast(alreadyLiked ? text.unlikeSuccess : text.likeSuccess, 'success');
      } catch (error) {
        console.error('Like error', error);
        showToast(alreadyLiked ? text.unlikeFailed : text.likeFailed, 'error');
      }
    },
    [likedIds, text.likeFailed, text.likeSuccess, text.unlikeFailed, text.unlikeSuccess],
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  };

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-600" />
      </div>
    );
  }

  return (
    <section className="space-y-6" id="marketplace">
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
          <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{text.sourceTitle}</p>
                <h3 className="truncate text-lg font-semibold text-slate-900">{sourceDialog.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSourceDialog({ open: false, title: '', content: '', loading: false })}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="min-h-[360px] overflow-auto bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
              {sourceDialog.loading ? text.loadingSource : sourceDialog.content}
            </pre>
          </div>
        </div>
      )}

      {(resolvedTitle || resolvedSubtitle) && (
        <div className="space-y-2">
          {resolvedTitle && <h2 className="text-2xl font-bold tracking-tight text-slate-900">{resolvedTitle}</h2>}
          {resolvedSubtitle && <p className="text-sm text-slate-600">{resolvedSubtitle}</p>}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-[250px] flex-1 sm:min-w-[300px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={text.searchPlaceholder}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none ring-sky-300 transition focus:border-sky-400 focus:ring-2"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-sky-300 transition focus:border-sky-400 focus:ring-2"
            >
              <option value="latest">{text.sortLatest}</option>
              <option value="oldest">{text.sortOldest}</option>
              <option value="mostViewed">{text.sortMostViewed}</option>
              <option value="leastViewed">{text.sortLeastViewed}</option>
              <option value="mostLiked">{text.sortMostLiked}</option>
              <option value="leastLiked">{text.sortLeastLiked}</option>
            </select>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none ring-sky-300 transition focus:border-sky-400 focus:ring-2"
            >
              <option value="all">{text.filterAll}</option>
              <option value="active">{text.filterActive}</option>
              <option value="inactive">{text.filterInactive}</option>
            </select>
          </div>
          <div className="text-sm text-slate-500">{text.totalApps(total)}</div>
        </div>

        {isRefreshing && !loading && <p className="mt-3 text-sm text-slate-500">{text.refreshing}</p>}
      </div>

      {deploys.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <p className="text-slate-600">{text.emptyState}</p>
          <Link href="/deploy" className="mt-2 inline-block text-sm font-medium text-sky-700 hover:text-sky-900">
            {text.emptyAction}
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {deploys.map((deploy) => (
            <article
              key={deploy.id}
              className="group/card flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="relative h-64 w-full overflow-hidden border-b border-slate-200 bg-white">
                {deploy.status === 'active' ? (
                  <>
                    <div className="absolute h-[200%] w-[200%] origin-top-left scale-50">
                      <iframe
                        src={`/s/${deploy.code}?preview=1`}
                        title={`${text.previewLabel}: ${deploy.title}`}
                        className="h-full w-full border-0 bg-white"
                        sandbox="allow-scripts"
                        loading="lazy"
                      />
                    </div>
                    <a
                      href={`/s/${deploy.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
                      title={text.previewOpenTitle}
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      {text.previewOpen}
                    </a>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-white via-white/95 to-transparent px-4 py-3 text-xs text-slate-500 opacity-0 transition-opacity group-hover/card:opacity-100">
                      {text.previewTip}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                    <PowerOff className="mb-3 h-8 w-8 opacity-30" />
                    <span className="text-sm font-medium text-slate-500">{text.projectOffline}</span>
                    <span className="mt-1 text-xs text-slate-400">{text.projectOfflineTip}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-slate-900" title={deploy.title}>
                        {deploy.title}
                      </h3>
                      <FileSizeInfo size={deploy.fileSize} tooltip={text.fileSizeTooltip} />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400" title={text.addressTitle(deploy.code)}>
                      {text.shortCode}: {deploy.code}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${
                      deploy.status === 'active'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    {deploy.status === 'active' ? text.filterActive : text.filterInactive}
                  </span>
                </div>

                <div className="flex-1 space-y-2 text-sm text-slate-500">
                  <div className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4" />
                    {formatDate(deploy.createdAt)}
                  </div>
                  <div className="flex items-center">
                    <Eye className="mr-2 h-4 w-4" />
                    {text.views(deploy.viewCount)}
                    <Heart className="ml-4 mr-2 h-4 w-4" />
                    {text.likes(deploy.likeCount)}
                  </div>
                  <div className="flex items-center">
                    <span className="line-clamp-2 text-slate-500" title={deploy.description || text.descriptionFallback}>
                      {deploy.description || text.descriptionFallback}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="flex space-x-1">
                    <Link
                      href={`/deploy/${deploy.id}`}
                      className="rounded-md p-2 text-slate-400 transition-colors hover:text-sky-600"
                      title={text.detailTitle}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    {deploy.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleLike(deploy)}
                        className={`rounded-md p-2 transition-colors ${
                          likedIds.has(deploy.id)
                            ? 'text-rose-500'
                            : 'text-slate-400 hover:text-rose-500'
                        }`}
                        title={likedIds.has(deploy.id) ? text.likedProject : text.likeProject}
                      >
                        <Heart className={`h-4 w-4 ${likedIds.has(deploy.id) ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDownload(deploy)}
                      className="rounded-md p-2 text-slate-400 transition-colors hover:text-sky-600"
                      title={text.downloadHtml}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleCopyCode(deploy)}
                      className="rounded-md p-2 text-slate-400 transition-colors hover:text-indigo-600"
                      title={text.copyCode}
                    >
                      {copiedId === deploy.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleViewCode(deploy)}
                      className="rounded-md p-2 text-slate-400 transition-colors hover:text-violet-600"
                      title={text.viewCode}
                    >
                      <Code2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleToggleStatus(deploy.id, deploy.status)}
                      disabled={deploy.likeCount > 0}
                      className={`rounded-md p-2 transition-colors ${
                        deploy.likeCount > 0
                          ? 'cursor-not-allowed text-slate-300'
                          : deploy.status === 'active'
                            ? 'text-slate-400 hover:text-amber-500'
                            : 'text-slate-400 hover:text-emerald-500'
                      }`}
                      title={deploy.likeCount > 0 ? text.lockedProject : deploy.status === 'active' ? text.putOffline : text.relaunch}
                    >
                      {deploy.status === 'active' ? <PowerOff className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(deploy.id)}
                      disabled={deploy.likeCount > 0}
                      className={`rounded-md p-2 transition-colors ${
                        deploy.likeCount > 0 ? 'cursor-not-allowed text-slate-300' : 'text-slate-400 hover:text-rose-600'
                      }`}
                      title={deploy.likeCount > 0 ? text.lockedProject : text.deleteForever}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span>{text.pageText(page, totalPages, total)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || isRefreshing}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {text.prevPage}
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || isRefreshing}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {text.nextPage}
          </button>
        </div>
      </div>
    </section>
  );
}
