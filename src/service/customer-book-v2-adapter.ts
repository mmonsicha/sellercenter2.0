import type { Address, Customer, TaxInformation } from '../lib/entities/customer/customer';
import type { Address as AddressEntity } from '../lib/entities/address/address';
import { type components } from './customer-book-v2-gen';

export function addressEntityToEntity(addr: components['schemas']['AddressEntity']): AddressEntity {
	return {
		administrativeAreaLevel1: addr.administrative_area_level1,
		administrativeAreaLevel2: addr.administrative_area_level2,
		administrativeAreaLevel3: addr.administrative_area_level3,
		contactName: addr.contact_name,
		coordinates: {
			latitude: addr.coordinates?.latitude ?? 0,
			longitude: addr.coordinates?.longitude ?? 0
		},
		country: {
			iso: addr.country_code
		},
		localityAreaLevel1: addr.locality_area_level1,
		localityAreaLevel2: addr.locality_area_level2,
		localityAreaLevel3: addr.locality_area_level3,
		notes: addr.notes,
		phone: addr.phone,
		postalCode: addr.postal_code,
		street: addr.street
	};
}

export function entityToAddressEntity(addr: AddressEntity): components['schemas']['AddressEntity'] {
	return {
		administrative_area_level1: addr.administrativeAreaLevel1,
		administrative_area_level2: addr.administrativeAreaLevel2,
		administrative_area_level3: addr.administrativeAreaLevel3,
		contact_name: addr.contactName ?? '',
		coordinates: addr.coordinates
			? {
					latitude: addr.coordinates.latitude,
					longitude: addr.coordinates.longitude
				}
			: undefined,
		country_code: addr.country?.iso ?? '',
		locality_area_level1: addr.localityAreaLevel1 ?? '',
		locality_area_level2: addr.localityAreaLevel2,
		locality_area_level3: addr.localityAreaLevel3,
		notes: addr.notes,
		phone: addr.phone,
		postal_code: addr.postalCode,
		street: addr.street
	};
}

export function addressToEntity(addr: components['schemas']['Address']): Address {
	return {
		id: addr.id,
		isDefault: addr.is_default,
		...addressEntityToEntity(addr.address!)
	};
}

export function entityToAddress(addr: Address): components['schemas']['Address'] {
	return {
		id: addr.id,
		is_default: addr.isDefault,
		address: entityToAddressEntity(addr)
	};
}

export function taxToEntity(tax: components['schemas']['TaxInformation']): TaxInformation {
	return {
		...addressEntityToEntity(tax.address),
		branchName: tax.branch_name,
		fullName: tax.full_name,
		id: tax.id,
		kind: tax.kind,
		taxNumber: tax.tax_number,
		email: tax.email
	};
}

export function entityToTax(tax: TaxInformation): components['schemas']['TaxInformation'] {
	return {
		address: entityToAddressEntity(tax),
		branch_name: tax.branchName,
		full_name: tax.fullName,
		id: tax.id,
		kind: tax.kind,
		tax_number: tax.taxNumber,
		email: tax.email
	};
}

export function customerToEntity(customer: components['schemas']['Customer']): Customer {
	return {
		addresses: customer.addresses?.map(addressToEntity) ?? [],
		countryCode: customer.country_code,
		email: customer.email,
		firstName: customer.first_name,
		id: customer.id,
		lastName: customer.last_name,
		latestOrder: customer.latest_order ? new Date(customer.latest_order) : undefined,
		createAt: customer.create_at ? new Date(customer.create_at) : undefined,
		orderList: customer.order_list,
		owner: customer.owner,
		phone: customer.phone,
		taxInformation: customer.tax_information?.map(taxToEntity) ?? []
	};
}

export function entityToCustomer(customer: Customer): components['schemas']['Customer'] {
	return {
		addresses: customer.addresses?.map(entityToAddress),
		country_code: customer.countryCode,
		email: customer.email || undefined,
		first_name: customer.firstName,
		id: customer.id,
		last_name: customer.lastName,
		latest_order: customer.latestOrder?.toISOString(),
		order_list: customer.orderList ?? [],
		owner: customer.owner,
		phone: customer.phone,
		tax_information: customer.taxInformation?.map(entityToTax)
	};
}
