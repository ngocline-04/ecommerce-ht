import { mock, intercepter } from '../config';
import { Role } from '@/interface/permission/role.interface';

export const mappingLabelModuleUser: any = {
  ADMIN_MODULE: 'Quản lý Admin',
  MANAGER_MODULE: 'Quản lý Manager',
  MEMBER_MODULE: 'Quản lý member',
};

export const ROLE_KEYCLOAK = {
  ADMIN: "NHS/CREDIT/ROLE_ADMIN",
  CREATE: "NHS/CREDIT/ROLE_CREATE",
  APPROVE: "NHS/CREDIT/ROLE_APPROVE",
  APPROVE_DS: "NHS/CREDIT/ROLE_APPROVE_DS",
  VIEW: "NHS/CREDIT/ROLE_VIEW",
};

export const rolesMappingLabel: Role[] = [
  {
    name: 'Quản lý người dùng',
    key: 'role_user',
    children: {
      ADD_ADMIN: 'Khởi tạo admin',
      VIEW_LIST_ALL_ADMIN: 'Xem danh sách tất cả admin',
      VIEW_DETAIL_ALL_ADMIN: 'Xem chi tiết thông tin admin',
      DEL_ALL_ADMIN: 'Xóa admin',
      EDIT_ALL_ADMIN: 'Chỉnh sửa thông tin admin',
      VIEW_LIST_ALL_MANAGER: 'Xem danh sách tất cả Manager',
      VIEW_LIST_OWN_MANAGER: 'Xem danh sách Member sở hữu',
      ADD_MANAGER: 'Khởi tạo Manager',
      VIEW_DETAIL_ALL_MANAGER: 'Xem chi tiết tất cả Manager',

      VIEW_DETAIL_OWN_MANAGER: 'Xem chi tiết Manager sở hữu',

      EDIT_ALL_MANAGER: 'Chỉnh sửa thông tin tất cả Manager',

      EDIT_OWN_MANAGER: 'Chỉnh sửa thông tin Manager sở hữu',

      DEL_ALL_MANAGER: 'Xóa tất cả Manager',

      DEL_OWN_MANAGER: 'Xóa tất cả Manager sở hữu',

      ADD_MEMBER: 'Khởi tạo Member của Agent',

      VIEW_LIST_ALL_MEMBER: 'Xem danh sách tất cả Member',

      VIEW_LIST_OWN_MEMBER: 'Xem danh sách Member sở hữu',

      VIEW_DETAIL_ALL_MEMBER: 'Xem chi tiết thông tin tất cả Member	',

      VIEW_DETAIL_OWN_MEMBER: 'Xem chi tiết thông tin Member sở hữu',

      EDIT_ALL_MEMBER: 'Chỉnh sửa thông tin Member',

      EDIT_OWN_MEMBER: 'Chỉnh sửa thông tin tất cả Member sở hữu',

      DEL_ALL_MEMBER: 'Xóa tất cả Member',

      DEL_OWN_MEMBER: 'Xóa Member sở hữu',
    },
  },
  {
    name: 'Phân quyền',
    key: 'role_agent',
    children: {
      VIEW_LIST_PERMISSION: 'Xem danh sách quyền',
      VIEW_LIST_ROLE: 'Xem danh sách role',
      EDIT_ROLE: 'Chỉnh sửa thông tin role',
      GRANT_PERMISSION: 'Phân quyền',
    },
  },
  {
    name: 'Quản lý Agent',
    key: 'role_agent',
    children: {
      ADD_AGENT: 'Thêm mới Agent',
      VIEW_LIST_ALL_AGENT: 'Xem danh sách tất cả Agent',
      VIEW_LIST_OWN_AGENT: 'Xem danh sách Agent sở hữu',
      VIEW_DETAIL_ALL_AGENT: 'Xem thông tin tất cả Agent',
      VIEW_DETAIL_OWN_AGENT: 'Xem thông tin Agent sở hữu',
      EDIT_DETAIL_ALL_AGENT: 'Chỉnh sửa thông tin tất cả Agent',
      EDIT_DETAIL_OWN_AGENT: 'Chỉnh sửa thông tin Agent sở hữu',
      DEL_ALL_AGENT: 'Xóa tất cả Agent',
      DEL_OWN_AGENT: 'Xóa agent sở hữu',
      ACTIVATED_ALL_AGENT: 'Active/Inactive tất cả Agent',
      ACTIVATED_OWN_AGENT: 'Active/Inactive Agent sở hữu',
    },
  },
  {
    name: 'Quản lý Segment',
    key: 'role_agent',
    children: {
      ADD_SEGMENT: 'Khởi tạo Segment của Agent',
      VIEW_LIST_ALL_SEGMENT: 'Xem danh sách tất cả Segment',
      VIEW_LIST_OWN_SEGMENT: 'Xem danh sách Segment sở hữu',
      VIEW_DETAIL_ALL_SEGMENT: 'Xem chi tiết thông tin tất cả Segment',
      VIEW_DETAIL_OWN_SEGMENT: 'Xem chi tiết thông tin Segment sở hữu',
      EDIT_ALL_SEGMENT: 'Chỉnh sửa thông tin tất cả Segment',
      EDIT_OWN_SEGMENT: 'Chỉnh sửa thông tin Segment sở hữu',
      DEL_ALL_SEGMENT: 'Xóa tất cả Segment',
      DEL_OWN_SEGMENT: 'Xóa Segment sở hữu',
      CONFIG_ALL_PARAMETER_SEGMENT_SYSTEM: 'Cấu hình tham số tất cả segment của hệ thống',
      CONFIG_OWN_PARAMETER_SEGMENT_SYSTEM: 'Cấu hình tham số segment của agent quản lý',
    },
  },
  {
    name: 'Quản lý log transaction',
    key: 'role_agent',
    children: {
      VIEW_DETAIL_ALL_LOG_TRANSACTION: 'Xem chi tiết tất cả log transaction',
      VIEW_DETAIL_OWN_LOG_TRANSACTION: 'Xem chi tiết log transaction của agent sở hữu',
    },
  },
  {
    name: 'Dashboard',
    key: 'role_agent',
    children: {
      VIEW_ALL_DASHBOARD: 'Xem dashboard của hệ thống',
      VIEW_DASHBOARD_AGENT: 'Xem dashboard của Agent',
      VIEW_DETAIL_ALL_BIOMETRIC_ID: 'Xem thông tin biometric ID',
    },
  },
];

mock.mock('/permission/role', 'get', intercepter(rolesMappingLabel));
