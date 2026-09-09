import { newAxiosClient } from '$lib/axios-client-v2';
import type { paths } from './pis-gen';
import { toSale } from './pis-adapter';

const env = import.meta.env;

const base = env.VITE_PIS_URL;

const pisClient = newAxiosClient(base, undefined, true);

export const listProduct = async (
	ref_id: string,
	offset: number = 0,
	limit: number = 10,
	type: string = '',
	keyword: string = ''
) => {
	const { data } = await pisClient.get<paths['/pis/products']['get']['responses'][200]['schema']>(
		`products`,
		{ params: { offset, limit, keyword, type, ref_id } }
	);

	return { results: data.results?.map(toSale), total: data.total ?? 0 };

	//mock
	// let mock = mockProducts.filter(
	// 	(product) =>
	// 		(type === '' || product.type === type) &&
	// 		(keyword === '' ||
	// 			(product.name && product.name.includes(keyword)) ||
	// 			(product.id && product.id == keyword))
	// );

	// const total = mock.length;
	// mock = mock.slice(offset, offset + limit);
	// const results = mock.map(toSale);

	// return { results, total };
};
