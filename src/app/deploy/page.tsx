'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, Eye, Calendar, ExternalLink, QrCode, PowerOff, PlayCircle } from 'lucide-react';
import { Deployment } from '@/lib/db';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function DeploymentsPage() {
  const [deploys, setDeploys] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
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

  const fetchDeploys = async () => {
    try {
      const res = await fetch('/api/deploys');
      const data = await res.json();
      setDeploys(data.deploys || []);
    } catch (error) {
      console.error('Failed to fetch deploys', error);
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

  const filteredDeploys = deploys.filter(d => {
    if (filter === 'all') return true;
    return d.status === filter;
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
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={dialogState.onConfirm}
        onCancel={closeDialog}
      />
      
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">部署历史</h1>
        <div className="flex space-x-2">
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
          <p className="text-gray-500">暂无部署记录</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            去部署第一个页面
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredDeploys.map((deploy) => (
            <div key={deploy.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium text-gray-900 truncate flex-1" title={deploy.title}>
                    {deploy.title}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    deploy.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {deploy.status === 'active' ? '运行中' : '已下架'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(deploy.createdAt)}
                  </div>
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    {deploy.viewCount} 次访问
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <div className="flex space-x-2">
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
