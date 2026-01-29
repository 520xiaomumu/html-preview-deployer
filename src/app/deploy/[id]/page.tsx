'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Deployment } from '@/lib/db';
import DeploySuccess from '@/components/DeploySuccess';
import ConfirmDialog from '@/components/ConfirmDialog';
import Preview from '@/components/Preview';
import { Trash2, ArrowLeft, Clock, Eye, PowerOff, PlayCircle } from 'lucide-react';
import Link from 'next/link';

export default function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [deploy, setDeploy] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [id, setId] = useState<string>('');
  const router = useRouter();

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
          alert('部署不存在');
          router.push('/deploy');
        }
      } catch (error) {
        console.error('Fetch error', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDeploy();
  }, [id, router]);

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
    const newStatus = deploy.status === 'active' ? 'inactive' : 'active';
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
            alert(`已${actionName}`);
            // Refresh data
            const updatedRes = await fetch(`/api/deploy/${id}`);
            const updatedData = await updatedRes.json();
            setDeploy(updatedData);
          } else {
            alert(`${actionName}失败`);
          }
        } catch (error) {
          console.error('Toggle status error', error);
          alert('操作失败');
        }
      }
    );
  };

  const handleDelete = () => {
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
            alert('已删除');
            router.push('/deploy');
          } else {
            alert('删除失败');
          }
        } catch (error) {
          console.error('Delete error', error);
          alert('操作失败');
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
        <h1 className="text-2xl font-bold text-gray-900">部署详情</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{deploy.title}</h2>
            <div className="flex space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {new Date(deploy.createdAt).toLocaleString('zh-CN')}
              </span>
              <span className="flex items-center">
                <Eye className="w-4 h-4 mr-1" />
                {deploy.viewCount} 次访问
              </span>
            </div>
          </div>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
            deploy.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {deploy.status === 'active' ? '运行中' : '已下架'}
          </span>
        </div>

        {deploy.status === 'active' ? (
          <div className="space-y-8">
            <DeploySuccess
              url={fullUrl}
              qrCode={deploy.qrCodePath}
              code={deploy.code}
            />
            
            <div className="pt-8 border-t border-gray-100">
              <h3 className="text-lg font-medium text-gray-900 mb-4">页面预览</h3>
              <Preview url={fullUrl} />
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={handleToggleStatus}
                className="flex items-center px-4 py-2 border border-orange-200 text-orange-700 rounded-md hover:bg-orange-50 transition-colors"
              >
                <PowerOff className="w-4 h-4 mr-2" />
                下架部署
              </button>
              
              <button
                onClick={handleDelete}
                className="flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                彻底删除
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <PowerOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">该部署已下架</p>
              <p className="text-gray-400 text-sm mt-1">链接已失效，如需恢复请点击重新上架</p>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={handleToggleStatus}
                className="flex items-center px-4 py-2 border border-green-200 text-green-700 rounded-md hover:bg-green-50 transition-colors"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                重新上架
              </button>
              
              <button
                onClick={handleDelete}
                className="flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                彻底删除
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
