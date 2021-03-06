package com.mycompany.myapp.client.petstore.api;

import com.mycompany.myapp.JhipsterApp;
import com.mycompany.myapp.client.petstore.TestUtils;
import com.mycompany.myapp.client.petstore.model.Category;
import com.mycompany.myapp.client.petstore.model.Pet;
import com.mycompany.myapp.client.petstore.model.Tag;
import feign.FeignException;
import org.junit.Ignore;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.junit4.SpringRunner;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.Assert.*;

@RunWith(SpringRunner.class)
@SpringBootTest(classes = JhipsterApp.class)
public class PetApiTest {

    @Autowired
    private PetApiClient client;

    @Test
    public void testCreateAndGetPet() {
        Pet pet = createRandomPet();
        client.addPet(pet);
        Pet fetched = client.getPetById(pet.getId()).getBody();
        assertNotNull(fetched);
        assertEquals(pet.getId(), fetched.getId());
        assertNotNull(fetched.getCategory());
        assertEquals(fetched.getCategory().getName(), pet.getCategory().getName());
    }

    @Test
    public void testUpdatePet() {
        Pet pet = createRandomPet();
        pet.setName("programmer");

        client.updatePet(pet);

        Pet fetched = client.getPetById(pet.getId()).getBody();
        assertNotNull(fetched);
        assertEquals(pet.getId(), fetched.getId());
        assertNotNull(fetched.getCategory());
        assertEquals(fetched.getCategory().getName(), pet.getCategory().getName());
    }

    @Test
    public void testFindPetsByStatus() {
        Pet pet = createRandomPet();
        pet.setName("programmer");
        pet.setStatus(Pet.StatusEnum.AVAILABLE);

        client.updatePet(pet);

        List<Pet> pets = client.findPetsByStatus(Collections.singletonList("available")).getBody();
        assertNotNull(pets);

        boolean found = false;
        for (Pet fetched : pets) {
            if (fetched.getId().equals(pet.getId())) {
                found = true;
                break;
            }
        }

        assertTrue(found);
    }

    @Test
    public void testFindPetsByTags() {
        Pet pet = createRandomPet();
        pet.setName("monster");
        pet.setStatus(Pet.StatusEnum.AVAILABLE);

        List<Tag> tags = new ArrayList<>();
        Tag tag1 = new Tag();
        tag1.setName("friendly");
        tags.add(tag1);
        pet.setTags(tags);

        client.updatePet(pet);

        List<Pet> pets = client.findPetsByTags(Collections.singletonList("friendly")).getBody();
        assertNotNull(pets);

        boolean found = false;
        for (Pet fetched : pets) {
            if (fetched.getId().equals(pet.getId())) {
                found = true;
                break;
            }
        }
        assertTrue(found);
    }

    @Test
    public void testUpdatePetWithForm() {
        Pet pet = createRandomPet();
        pet.setName("frank");
        client.addPet(pet);

        Pet fetched = client.getPetById(pet.getId()).getBody();

        client.updatePetWithForm(fetched.getId(), "furt", null);
        Pet updated = client.getPetById(fetched.getId()).getBody();

        assertEquals(updated.getName(), "furt");
    }

    @Test
    public void testDeletePet() {
        Pet pet = createRandomPet();
        client.addPet(pet);

        Pet fetched = client.getPetById(pet.getId()).getBody();
        client.deletePet(fetched.getId(), null);

        try {
            client.getPetById(fetched.getId());
            fail("expected an error");
        } catch (FeignException e) {
            assertTrue(e.getMessage().startsWith("status 404 "));
        }
    }

    @Ignore("Multipart form is not supported by spring-cloud yet.")
    @Test
    public void testUploadFile() {
        Pet pet = createRandomPet();
        client.addPet(pet);

        MockMultipartFile filePart = new MockMultipartFile("file", "bar".getBytes());
        client.uploadFile(pet.getId(), "a test file", filePart);
    }

    @Test
    public void testEqualsAndHashCode() {
        Pet pet1 = new Pet();
        Pet pet2 = new Pet();
        assertTrue(pet1.equals(pet2));
        assertTrue(pet2.equals(pet1));
        assertTrue(pet1.hashCode() == pet2.hashCode());
        assertTrue(pet1.equals(pet1));
        assertTrue(pet1.hashCode() == pet1.hashCode());

        pet2.setName("really-happy");
        pet2.setPhotoUrls(Arrays.asList("http://foo.bar.com/1", "http://foo.bar.com/2"));
        assertFalse(pet1.equals(pet2));
        assertFalse(pet2.equals(pet1));
        assertFalse(pet1.hashCode() == (pet2.hashCode()));
        assertTrue(pet2.equals(pet2));
        assertTrue(pet2.hashCode() == pet2.hashCode());

        pet1.setName("really-happy");
        pet1.setPhotoUrls(Arrays.asList("http://foo.bar.com/1", "http://foo.bar.com/2"));
        assertTrue(pet1.equals(pet2));
        assertTrue(pet2.equals(pet1));
        assertTrue(pet1.hashCode() == pet2.hashCode());
        assertTrue(pet1.equals(pet1));
        assertTrue(pet1.hashCode() == pet1.hashCode());
    }

    private Pet createRandomPet() {
        Pet pet = new Pet();
        pet.setId(TestUtils.nextId());
        pet.setName("gorilla");

        Category category = new Category();
        category.setName("really-happy");

        pet.setCategory(category);
        pet.setStatus(Pet.StatusEnum.AVAILABLE);
        List<String> photos = Arrays.asList("http://foo.bar.com/1", "http://foo.bar.com/2");
        pet.setPhotoUrls(photos);

        return pet;
    }

}

