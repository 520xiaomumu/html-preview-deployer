'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Trash2, Eye, Calendar, ExternalLink, PowerOff, PlayCircle, Download, Copy, Check, HardDrive, Search } from 'lucide-react';
import { Deployment } from '@/lib/db';
import ConfirmDialog from '@/components/ConfirmDialog';
import Toast from '@/components/Toast';

function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FileSizeInfo({ size }: { size: number | null | undefined }) {
  const formattedSize = formatFileSize(size);

  if (!formattedSize) return null;
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600" title="HTML 文件大小">
      <HardDrive className="mr-1 h-3.5 w-3.5" />
      {formattedSize}
    </div>
  );
}

export default function DeploymentsPage() {
  const [deploys, setDeploys] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'mostViewed' | 'leastViewed'>('latest');
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    type: 'info',
  });
  
  // Dialog State
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

  // Track which card just had its code copied
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, type });
  };

  const fetchDeploys = async () => {
    try {
      const res = await fetch('/api/deploys');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取部署列表失败');
      }
      setDeploys(data.deploys || []);
    } catch (error) {
      console.error('Failed to fetch deploys', error);
      showToast('获取部署列表失败，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeploys();
  }, []);

  const closeDialog = () => {
    setDialogState(prev => ({ ...prev, isOpen: false }));
  };

  const showDialog = (
    type: 'danger' | 'warning' | 'info',
    title: string,
    message: string,
    onConfirm: () => void
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

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionName = newStatus === 'active' ? '上架' : '下架';
    
    showDialog(
      newStatus === 'inactive' ? 'warning' : 'info',
      `确认${actionName}`,
      `确定要${actionName}这个部署吗？${newStatus === 'inactive' ? '下架后链接将暂时失效。' : '上架后链接将恢复访问。'}`,
      async () => {
        try {
          const res = await fetch(`/api/deploy/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          if (res.ok) {
            fetchDeploys();
            showToast(`已${actionName}`, 'success');
          } else {
            showToast(`${actionName}失败`, 'error');
          }
        } catch (error) {
          console.error('Toggle status error', error);
          showToast('操作失败', 'error');
        }
      }
    );
  };

  const handleDelete = (id: string) => {
    showDialog(
      'danger',
      '确认彻底删除',
      '确定要彻底删除这个部署吗？删除后所有数据和文件将无法恢复！',
      async () => {
        try {
          const res = await fetch(`/api/deploy/${id}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            fetchDeploys();
            showToast('已删除该部署', 'success');
          } else {
            showToast('删除失败', 'error');
          }
        } catch (error) {
          console.error('Delete error', error);
          showToast('操作失败', 'error');
        }
      }
    );
  };

  const handleDownload = useCallback(async (deploy: Deployment) => {
    try {
      const res = await fetch(deploy.filePath);
      if (!res.ok) throw new Error('下载失败');
      const html = await res.text();
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
      showToast('下载失败', 'error');
    }
  }, []);

  const handleCopyCode = useCallback(async (deploy: Deployment) => {
    try {
      const res = await fetch(deploy.filePath);
      if (!res.ok) throw new Error('获取内容失败');
      const html = await res.text();
      await navigator.clipboard.writeText(html);
      setCopiedId(deploy.id);
      showToast('源码已复制到剪贴板', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Copy error', error);
      showToast('复制失败', 'error');
    }
  }, []);

  const filteredDeploys = deploys
    .filter(d => {
      const matchesFilter = filter === 'all' || d.status === filter;
      const keyword = searchTerm.trim().toLowerCase();
      const matchesSearch =
        keyword.length === 0 ||
        d.title.toLowerCase().includes(keyword) ||
        d.filename.toLowerCase().includes(keyword) ||
        d.code.toLowerCase().includes(keyword);

      return matchesFilter && matchesSearch;
    })
    .sort((left, right) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case 'mostViewed':
          return right.viewCount - left.viewCount;
        case 'leastViewed':
          return left.viewCount - right.viewCount;
        case 'latest':
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">部署历史</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索标题、文件名或部署码"
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'oldest' | 'mostViewed' | 'leastViewed')}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            <option value="latest">按时间：最新优先</option>
            <option value="oldest">按时间：最早优先</option>
            <option value="mostViewed">按访问量：从高到低</option>
            <option value="leastViewed">按访问量：从低到高</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          >
            <option value="all">全部状态</option>
            <option value="active">运行中</option>
            <option value="inactive">已下架</option>
          </select>
        </div>
      </div>

      {filteredDeploys.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">{deploys.length === 0 ? '暂无部署记录' : '没有符合条件的部署'}</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            去部署第一个页面
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredDeploys.map((deploy) => (
            <div key={deploy.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col group/card">
              {/* HTML Preview Area */}
              <div className="relative w-full h-64 bg-white border-b border-gray-200 overflow-hidden group/preview">
                {deploy.status === 'active' ? (
                  <>
                    <div className="absolute w-[200%] h-[200%] origin-top-left scale-50">
                      <iframe
                        src={`/s/${deploy.code}?preview=1`}
                        title={`预览: ${deploy.title}`}
                        className="w-full h-full border-0 bg-white"
                        sandbox="allow-scripts"
                        loading="lazy"
                      />
                    </div>
                    <a
                      href={`/s/${deploy.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full border border-white/70 bg-white/92 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
                      title="在新标签页中打开完整预览"
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      打开预览
                    </a>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-white via-white/95 to-transparent px-4 py-3 text-xs text-gray-500 opacity-0 transition-opacity group-hover/preview:opacity-100">
                      可直接拖动右侧滚动条查看完整页面，或点击右上角进入完整预览
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50 z-10">
                    <PowerOff className="w-8 h-8 mb-3 opacity-30" />
                    <span className="text-sm font-medium text-gray-500">项目已下架</span>
                    <span className="text-xs mt-1 text-gray-400">重新上架后可恢复预览</span>
                  </div>
                )}
              </div>

              <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate" title={deploy.title}>
                        {deploy.title}
                      </h3>
                      <FileSizeInfo size={deploy.fileSize} />
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-400" title={deploy.filename}>
                      {deploy.filename}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 text-xs font-semibold rounded-full border ${
                    deploy.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                    {deploy.status === 'active' ? '运行中' : '已下架'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-500 flex-1">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(deploy.createdAt)}
                  </div>
                  <div className="flex items-center">
                    <span className="flex items-center">
                      <Eye className="w-4 h-4 mr-2" />
                      {deploy.viewCount} 次访问
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <div className="flex space-x-1">
                    <Link
                      href={`/deploy/${deploy.id}`}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="查看详情"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    {deploy.status === 'active' && (
                      <a
                        href={`/s/${deploy.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="访问页面"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDownload(deploy)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="下载 HTML 文件"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyCode(deploy)}
                      className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                      title="复制代码"
                    >
                      {copiedId === deploy.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleToggleStatus(deploy.id, deploy.status)}
                      className={`p-2 transition-colors ${
                        deploy.status === 'active' 
                          ? 'text-gray-400 hover:text-orange-500' 
                          : 'text-gray-400 hover:text-green-500'
                      }`}
                      title={deploy.status === 'active' ? "下架" : "上架"}
                    >
                      {deploy.status === 'active' ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleDelete(deploy.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="彻底删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
