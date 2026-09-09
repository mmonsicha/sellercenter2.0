import { newAxiosClient } from '$lib/axios-client-v2';
import type { Customer } from '$lib/entities/customer/customer';
import { type operations } from './customer-book-v2-gen';
import { customerToEntity, entityToCustomer } from './customer-book-v2-adapter';

const env = import.meta.env;

const base = env.VITE_CUSTOMER_BOOK_V2_URL;
const client = newAxiosClient(base, undefined, true);

export const createCustomer = async (c: Customer): Promise<number> => {
	const cus = entityToCustomer(c);

	const response = await client.post<
		operations['CreateCustomer']['responses'][201]['content']['application/json']
	>('/customers', cus);

	return response.data.id;
};

export const updateCustomer = (c: Customer) => {
	const cus = entityToCustomer(c);

	return client.put<operations['UpdateCustomer']['responses'][200]['content']['application/json']>(
		`/customers`,
		cus
	);
};

export const updateCustomerWithAccess = (c: Customer) => {
	const cus = entityToCustomer(c);

	return client.put<
		operations['UpdateCustomerThatHaveAccess']['responses'][200]['content']['application/json']
	>(`/customers/access`, cus);
};

export const getCustomerById = async (id: string, owner: string) => {
	const resp = await client.get<
		operations['GetCustomerById']['responses'][200]['content']['application/json']
	>(`/customers/${id}`, {
		params: {
			owner
		}
	});

	return customerToEntity(resp.data);
};

export const getCustomerByIdWithAccess = async (id: string, owner: string) => {
	const resp = await client.get<
		operations['GetCustomerThatHaveAccess']['responses'][200]['content']['application/json']
	>(`/customers/${id}/access`, {
		params: {
			owner
		}
	});

	return customerToEntity(resp.data);
};

export const listCustomers = async (
	owner: string,
	search?: string,
	per_page: number = 10,
	page: number = 1,
	sort_by: operations['ListCustomers']['parameters']['query']['sort_by'] = 'created_at',
	sort_order: operations['ListCustomers']['parameters']['query']['sort_order'] = 'desc'
) => {
	const params: operations['ListCustomers']['parameters']['query'] = {
		owner,
		page,
		per_page,
		sort_by,
		sort_order,
		search
	};

	const resp = await client.get<
		operations['ListCustomers']['responses'][200]['content']['application/json']
	>('/customers', { params });

	return {
		customers: resp.data.customers.map(customerToEntity),
		total: resp.data.total
	};
};

export const listCustomersWithAccess = async (
	owner: string,
	search?: string,
	per_page: number = 10,
	page: number = 1,
	sort_by: operations['ListAllCustomerThatHaveAccess']['parameters']['query']['sort_by'] = 'created_at',
	sort_order: operations['ListAllCustomerThatHaveAccess']['parameters']['query']['sort_order'] = 'desc'
) => {
	const params: operations['ListAllCustomerThatHaveAccess']['parameters']['query'] = {
		owner,
		page,
		per_page,
		sort_by,
		sort_order,
		search
	};

	const resp = await client.get<
		operations['ListAllCustomerThatHaveAccess']['responses'][200]['content']['application/json']
	>('/customers/access', { params });

	return {
		customers: resp.data.customers.map(customerToEntity),
		total: resp.data.total
	};
};

export const getCustomer = async (
	owner: string,
	first_name: string,
	last_name: string,
	phone: string,
	country_code: string
) => {
	const params: operations['GetCustomer']['parameters']['query'] = {
		owner,
		first_name,
		last_name,
		phone,
		country_code
	};

	const resp = await client.get<
		operations['GetCustomer']['responses'][200]['content']['application/json']
	>('/customer', { params });

	return customerToEntity(resp.data);
};

export const customerCheckPermissionsEach = async (
	kind: string,
	id: string,
	permissions: string[]
) => {
	try {
		const resp = await client.get<
			operations['CheckPermissionEach']['responses'][200]['content']['application/json']
		>('/checkpermission/each', {
			params: {
				kind,
				id,
				permissions: Array.isArray(permissions) ? permissions.join(',') : []
			}
		});
		return resp.data;
	} catch (error: any) {
		throw error;
	}
};
