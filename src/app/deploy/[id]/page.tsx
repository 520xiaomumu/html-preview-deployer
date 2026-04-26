'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Deployment } from '@/lib/db';
import DeploySuccess from '@/components/DeploySuccess';
import ConfirmDialog from '@/components/ConfirmDialog';
import Preview from '@/components/Preview';
import Toast from '@/components/Toast';
import { Trash2, ArrowLeft, Clock, Eye, Heart, PowerOff, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';

export default function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { language, isZh } = useLanguage();

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
            views: (count: number) => `${count} 次访问`,
            active: '运行中',
            inactive: '已下架',
            previewTitle: '页面预览',
            unpublishDeploy: '下架部署',
            deleteForever: '彻底删除',
            lockedByLike: '该项目已被点赞锁定，不能下架、上架或删除。',
            inactiveTipTitle: '该部署已下架',
            inactiveTipDesc: '链接已失效，如需恢复请点击重新上架',
            republish: '重新上架',
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
            views: (count: number) => `${count} views`,
            active: 'Active',
            inactive: 'Offline',
            previewTitle: 'Page Preview',
            unpublishDeploy: 'Unpublish Deployment',
            deleteForever: 'Delete Permanently',
            lockedByLike: 'This project has likes and is locked from publishing changes or deletion.',
            inactiveTipTitle: 'This deployment is offline',
            inactiveTipDesc: 'The link is unavailable. Republish to restore access.',
            republish: 'Republish',
          },
    [isZh],
  );

  const [deploy, setDeploy] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<string>('');
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    type: 'info',
  });
  const router = useRouter();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ open: true, message, type });
  };

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

  useEffect(() => {
    const unwrapParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    unwrapParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const fetchDeploy = async () => {
      try {
        const res = await fetch(`/api/deploy/${id}`);
        if (res.ok) {
          const data = await res.json();
          setDeploy(data);
        } else {
          showToast(text.notFound, 'error');
          router.push('/deploy');
        }
      } catch (error) {
        console.error('Fetch error', error);
        showToast(text.fetchFailed, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchDeploy();
  }, [id, router, text.fetchFailed, text.notFound]);

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
            // Refresh data
            const updatedRes = await fetch(`/api/deploy/${id}`);
            const updatedData = await updatedRes.json();
            setDeploy(updatedData);
          } else {
            showToast(text.actionFailed(actionName), 'error');
          }
        } catch (error) {
          console.error('Toggle status error', error);
          showToast(text.operationFailed, 'error');
        }
      }
    );
  };

  const handleDelete = () => {
    if (deploy && deploy.likeCount > 0) {
      showToast(text.lockedByLike, 'info');
      return;
    }

    showDialog(
      'danger',
      text.deleteTitle,
      text.deleteMsg,
      async () => {
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
      }
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!deploy) return null;

  const host = window.location.host;
  const protocol = window.location.protocol;
  const fullUrl = `${protocol}//${host}/s/${deploy.code}`;

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

      <div className="flex items-center space-x-4 mb-6">
        <Link href="/deploy" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{text.detail}</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{deploy.title}</h2>
            <div className="flex space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {new Date(deploy.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}
              </span>
              <span className="flex items-center">
                <Eye className="w-4 h-4 mr-1" />
                {text.views(deploy.viewCount)}
              </span>
              <span className="flex items-center">
                <Heart className="w-4 h-4 mr-1" />
                {deploy.likeCount}
              </span>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
            deploy.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {deploy.status === 'active' ? text.active : text.inactive}
          </span>
        </div>

        {deploy.status === 'active' ? (
          <div className="space-y-8">
            <DeploySuccess
              url={fullUrl}
              qrCode={deploy.qrCodePath}
              code={deploy.code}
              onNotify={showToast}
            />
            
            <div className="pt-8 border-t border-gray-100">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{text.previewTitle}</h3>
              <Preview url={fullUrl} />
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={handleToggleStatus}
                disabled={deploy.likeCount > 0}
                className="flex items-center px-4 py-2 border border-orange-200 text-orange-700 rounded-md transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={deploy.likeCount > 0 ? text.lockedByLike : undefined}
              >
                <PowerOff className="w-4 h-4 mr-2" />
                {text.unpublishDeploy}
              </button>
              
              <button
                onClick={handleDelete}
                disabled={deploy.likeCount > 0}
                className="flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-md transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={deploy.likeCount > 0 ? text.lockedByLike : undefined}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {text.deleteForever}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <PowerOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">{text.inactiveTipTitle}</p>
              <p className="text-gray-400 text-sm mt-1">{text.inactiveTipDesc}</p>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={handleToggleStatus}
                disabled={deploy.likeCount > 0}
                className="flex items-center px-4 py-2 border border-green-200 text-green-700 rounded-md transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={deploy.likeCount > 0 ? text.lockedByLike : undefined}
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                {text.republish}
              </button>
              
              <button
                onClick={handleDelete}
                disabled={deploy.likeCount > 0}
                className="flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-md transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={deploy.likeCount > 0 ? text.lockedByLike : undefined}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {text.deleteForever}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
